import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { useTheme } from "@/theme";
import { ChartPaintProvider } from "../colors";
import { Circle, DashPathEffect, Path } from "@shopify/react-native-skia";

import { buildConfiguration, buildMultiConfiguration } from "../../config/buildConfiguration";
import type { ChartRenderingConfiguration } from "../../config/ChartRenderingConfiguration";
import type { AspectEdgeDTO, ChartCalculationResponse } from "../../config/engine-types";
import chart from "../../fixtures/engine/sibly-1776.json";
import classic from "../../fixtures/presets/classic.json";
import { parsePreset } from "../../schema/preset";
import type { AspectOverlayStyle } from "../../schema/ring-styles";
import { AspectOverlay } from "../AspectOverlay";
import { useWheelLayout } from "../useWheelLayout";

const engineChart = chart as ChartCalculationResponse;
const edge = (orb: number, overrides: Partial<AspectEdgeDTO> = {}): AspectEdgeDTO => ({
  from: "sun", to: "moon", aspect_type: "Trine", orb, strength: 1,
  is_applying: true, ...overrides,
});

function configuration(
  edges: AspectEdgeDTO[],
  style: Partial<AspectOverlayStyle> = {},
  orbs: Record<string, number> = { Trine: 8, Conjunction: 8 },
): ChartRenderingConfiguration {
  const config = buildConfiguration(engineChart, parsePreset(classic));
  return {
    ...config,
    aspectEdges: edges,
    aspects: {
      ...config.aspects, enabled: true, enabledTypes: ["Trine", "Conjunction", "Square"],
      showFalseAspects: true, showSeparatingAspects: true, interAspectsOnly: false,
      orbs: { ...config.aspects.orbs, orbs },
    },
    aspectOverlayStyle: {
      ...config.aspectOverlayStyle, lineWidth: 2, orbWeighting: 1,
      maximumAspectCount: 0, minimumStrength: 0, ...style,
    },
  };
}

function Overlay({ config }: { config: ChartRenderingConfiguration }) {
  // Reference size gives scale 1 while exercising the real layout/scaler/filter pipeline.
  const theme = useTheme();
  const layout = useWheelLayout(config, 400);
  return <ChartPaintProvider value={theme}><AspectOverlay config={config} layout={layout} /></ChartPaintProvider>;
}

const mounted: TestRenderer.ReactTestRenderer[] = [];
function mount(config: ChartRenderingConfiguration) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<Overlay config={config} />); });
  mounted.push(renderer);
  return renderer;
}
afterEach(() => { act(() => { mounted.splice(0).forEach(renderer => renderer.unmount()); }); });

it.each(["straight", "bezier"] as const)("weights actual %s aspect strokes and preserves separating dashes", renderMode => {
  const renderer = mount(configuration([
    edge(0),
    edge(4, { to: "mercury", is_applying: false }),
    edge(8, { to: "venus" }),
  ], { renderMode, useDashedForSeparating: true }));
  const paths = renderer.root.findAllByType(Path);
  expect(paths).toHaveLength(3);
  expect(paths.map(path => path.props.strokeWidth)).toEqual([2, 0.5, 0.15]);
  expect(paths[0].findAllByType(DashPathEffect)).toHaveLength(0);
  expect(paths[1].findAllByType(DashPathEffect)).toHaveLength(1);
  expect(paths[0].props.path.toSVGString()).toMatch(renderMode === "bezier" ? /Q/ : /L/);
});

it("zero weighting preserves chosen width for every orb including separating lines", () => {
  const renderer = mount(configuration([
    edge(0), edge(4, { to: "mercury" }), edge(8, { to: "venus", is_applying: false }),
  ], { lineWidth: 1.7, orbWeighting: 0, useDashedForSeparating: true }));
  expect(renderer.root.findAllByType(Path).map(path => path.props.strokeWidth)).toEqual([1.7, 1.7, 1.7]);
});

it("partial weighting softens contrast and changing base thickness scales it", () => {
  const first = mount(configuration([edge(0), edge(4, { to: "mercury" }), edge(8, { to: "venus" })], { orbWeighting: 0.5 }));
  expect(first.root.findAllByType(Path).map(path => path.props.strokeWidth)).toEqual([2, 1.25, 1]);
  const second = mount(configuration([edge(4)], { lineWidth: 4, orbWeighting: 0.5 }));
  expect(second.root.findByType(Path).props.strokeWidth).toBe(2.5);
});

it("normalizes by each configured aspect tolerance, ignores engine strength, and filters outside tolerance", () => {
  const renderer = mount(configuration([
    edge(-4, { strength: 0.1 }),
    edge(4, { to: "mercury", aspect_type: "Square", strength: 0.9 }),
    edge(4.01, { to: "venus", aspect_type: "Square" }),
  ], {}, { Trine: 8, Square: 4 }));
  const paths = renderer.root.findAllByType(Path);
  expect(paths).toHaveLength(2);
  expect(paths.map(path => path.props.strokeWidth)).toEqual([0.5, 0.15]);
});

it("uses the same effective thickness for conjunction dot radii", () => {
  const renderer = mount(configuration([
    edge(0, { aspect_type: "Conjunction" }),
    edge(4, { to: "mercury", aspect_type: "Conjunction" }),
    edge(8, { to: "venus", aspect_type: "Conjunction" }),
  ]));
  expect(renderer.root.findAllByType(Path)).toHaveLength(0);
  expect(renderer.root.findAllByType(Circle).map(circle => circle.props.r)).toEqual([4, 1, 0.3]);
});

it("renders exact zero-tolerance aspects at full width and never thickens a base below the visibility floor", () => {
  const exact = mount(configuration([edge(0)], {}, { Trine: 0 }));
  expect(exact.root.findByType(Path).props.strokeWidth).toBe(2);
  const thin = mount(configuration([edge(8)], { lineWidth: 0.1 }));
  expect(thin.root.findByType(Path).props.strokeWidth).toBe(0.1);
});

it("weights chart-qualified cross-chart edges through real dual-ring membership", () => {
  const dual = buildMultiConfiguration([
    { instanceId: "natal", chart: engineChart },
    { instanceId: "transits", chart: engineChart },
  ], parsePreset(classic));
  const planetRings = dual.rings.filter(ring => ring.type.kind === "planets");
  const endpoints = planetRings.map(ring => {
    if (ring.type.kind !== "planets") throw new Error("Expected planet ring");
    return ring.type.placements.find(placement => placement.bodyId === "sun")!.id;
  });
  expect(endpoints).toHaveLength(2);
  expect(endpoints[0]).not.toBe(endpoints[1]);
  const config = configuration([edge(4, { from: endpoints[0], to: endpoints[1] })]);
  config.rings = dual.rings;
  config.chartCount = dual.chartCount;
  config.aspects.interAspectsOnly = true;
  expect(mount(config).root.findByType(Path).props.strokeWidth).toBe(0.5);
});
