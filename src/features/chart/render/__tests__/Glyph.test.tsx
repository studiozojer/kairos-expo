/**
 * Glyph load-failure hardening (Task 9 fix round 1, finding 1).
 *
 * The standard jest Skia mock (jest.setup.js → the package's own
 * jestSetup.js) always returns `null` from `useSVG` — it can't simulate the
 * failure mode this guards against: a `useSVG` result that is non-null but
 * wraps a NULL native SkSVG (observed for a Metro asset URL that reached the
 * native fetch mangled — since fixed at the source, sync-chart-glyphs.mjs
 * now slugifies copied filenames). Calling `.width()`/`.height()` on that
 * object dereferences a null pointer natively and segfaults — unrecoverable,
 * no JS `try`/`catch` survives an actual native crash. This file overrides
 * just `useSVG` (reusing the package's own jest `Mock()` factory for every
 * other export, so `Group`/`Paint`/`BlendColor`/`ImageSVG`/`fitbox`/`rect`
 * behave exactly as in every other test) to simulate the subset of failures
 * that DO surface as a catchable error, and asserts `Glyph` degrades to
 * rendering nothing instead of touching `.width()` unguarded.
 */

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("@shopify/react-native-skia", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Mock } = require("@shopify/react-native-skia/lib/module/mock");
  const base = Mock((global as unknown as { CanvasKit: unknown }).CanvasKit);
  return {
    ...base,
    useSVG: jest.fn(() => null),
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useSVG } = require("@shopify/react-native-skia") as { useSVG: jest.Mock };

import { Glyph } from "../Glyph";

afterEach(() => {
  useSVG.mockReset();
  useSVG.mockImplementation(() => null);
});

test("renders nothing while useSVG has not resolved (baseline mock behavior)", () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <Glyph name="celestials/sun" size={18} color="#000000ff" x={0} y={0} />,
    );
  });
  expect(renderer.toJSON()).toBeNull();
});

test("a loaded SVG whose width()/height() throw renders null instead of crashing", () => {
  const broken = {
    width: () => {
      throw new Error("native pointer is null");
    },
    height: () => {
      throw new Error("native pointer is null");
    },
  };
  useSVG.mockImplementation(() => broken);
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

  let renderer!: TestRenderer.ReactTestRenderer;
  expect(() => {
    act(() => {
      renderer = TestRenderer.create(
        <Glyph name="celestials/sun" size={18} color="#000000ff" x={0} y={0} />,
      );
    });
  }).not.toThrow();

  expect(renderer.toJSON()).toBeNull();
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

test("a healthy SVG (width/height succeed) renders an ImageSVG-bearing tree", () => {
  const healthy = { width: () => 20, height: () => 20 };
  useSVG.mockImplementation(() => healthy);

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <Glyph name="celestials/sun" size={18} color="#000000ff" x={0} y={0} />,
    );
  });
  // The healthy path resolves dims via useEffect (one tick after mount), so
  // it renders null on the FIRST pass and the real tree once dims land —
  // both are exercised here since `act` flushes effects synchronously.
  expect(renderer.toJSON()).not.toBeNull();
});

test("glyph opacity lives on a native layer paint without standalone paint declarations", () => {
  const svg = { width: () => 20, height: () => 20 };
  useSVG.mockImplementation(() => svg);
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(<Glyph name="celestials/sun" size={20} color="#ff0000" opacity={.2} x={20} y={20} />); });
  expect(renderer.root.findAll(node => (node.type as unknown) === 'skPaint')).toHaveLength(0);
  const layers = renderer.root.findAll(node => (node.type as unknown) === 'skGroup' && node.props.layer);
  expect(layers).toHaveLength(1);
  expect(layers[0].props.layer.getAlphaf()).toBeCloseTo(.2);
  act(() => renderer.update(<Glyph name="celestials/sun" size={20} color="#ff0000" opacity={1} x={20} y={20} />));
  expect(renderer.root.findAll(node => (node.type as unknown) === 'skGroup' && node.props.layer)[0].props.layer.getAlphaf()).toBe(1);
  act(() => renderer.unmount());
});
