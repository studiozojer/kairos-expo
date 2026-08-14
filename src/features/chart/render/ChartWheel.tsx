/**
 * ChartWheel — the wheel shell. A Skia Canvas of `size`×`size`; every ring
 * draws inside one Group carrying the `transform` prop (the one-renderer
 * parameterization per the design doc: thumbnails/embeds scale + offset this
 * shell rather than rendering their own wheel).
 *
 * Rings dispatch through RING_RENDERERS — a component map, no switch (the
 * design's open-extensibility point: a ring type is a component registered
 * under its RingContentType kind). Kinds with no entry are skipped. Layout
 * math is NOT here — useWheelLayout owns it; this component only composes.
 *
 * THEME PLUMBING (load-bearing): Skia's Canvas renders children in its own
 * react-reconciler root (renderer/Canvas.js → skiaReconciler), so app React
 * context — including the theme-mode override behind useTheme() — does NOT
 * reach ring components. useTheme() is therefore read HERE (normal RN tree)
 * and re-provided inside the Canvas via ChartPaintProvider (colors.ts).
 */

import React, { useMemo } from "react";

import { Canvas, Group } from "@shopify/react-native-skia";

import { useTheme } from "@/theme";

import type {
  ChartRenderingConfiguration,
  RingConfiguration,
  RingContentType,
} from "../config/ChartRenderingConfiguration";
import type { ChartColors } from "../schema/core-types";
import { ChartPaintProvider } from "./colors";
import { ZodiacSignsRing } from "./rings/ZodiacSignsRing";
import { useWheelLayout, type WheelLayout } from "./useWheelLayout";

export interface RingRendererProps {
  /** The ring to draw — style + thickness already display-scaled (layout). */
  ring: RingConfiguration;
  /** Index into layout (0 = outermost). */
  ringIndex: number;
  layout: WheelLayout;
  /** The preset's raw ChartColors (resolve via colors.ts against the theme). */
  colors: ChartColors;
}

export type RingRendererComponent = (props: RingRendererProps) => React.ReactElement | null;

/** Placeholder for kinds whose renderers land in Task 9+. Draws nothing. */
function UnrenderedRing(_props: RingRendererProps) {
  return null;
}

/**
 * Ring kind → component. The Record is total over the KNOWN union (Task 9
 * replaces the placeholders); ChartWheel still guards the lookup so a
 * config carrying a future kind skips rather than crashes.
 */
export const RING_RENDERERS: Record<RingContentType["kind"], RingRendererComponent> = {
  zodiacSigns: ZodiacSignsRing,
  planets: UnrenderedRing, // Task 9
  houseNumbers: UnrenderedRing, // Task 9
  cuspAnnotations: UnrenderedRing, // Task 9+
  empty: UnrenderedRing,
};

/** Skia Group transform wrapping all rings. Defaults to identity. */
export interface ChartWheelTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

const IDENTITY_TRANSFORM: ChartWheelTransform = { scale: 1, offsetX: 0, offsetY: 0 };

export interface ChartWheelProps {
  config: ChartRenderingConfiguration;
  /** Square canvas size in points. */
  size: number;
  transform?: ChartWheelTransform;
}

export function ChartWheel({ config, size, transform = IDENTITY_TRANSFORM }: ChartWheelProps) {
  const liveTheme = useTheme();
  // themeFor() builds a fresh object per useTheme() call; the color tables
  // are static per scheme, so pin the value to the scheme — otherwise every
  // render churns ChartPaintContext and defeats the layout/ring memos.
  const theme = useMemo(() => liveTheme, [liveTheme.scheme]);
  const layout = useWheelLayout(config, size);

  return (
    <Canvas style={{ width: size, height: size }}>
      <ChartPaintProvider value={theme}>
        {/*
         * Transform order: Skia multiplies the array in order, so a point p
         * maps to T(offset)·S(scale)·p — the wheel scales about its own
         * origin, then offsets (the offset itself is NOT scaled).
         */}
        <Group
          transform={[
            { translateX: transform.offsetX },
            { translateY: transform.offsetY },
            { scale: transform.scale },
          ]}>
          {layout.rings.map((ring, ringIndex) => {
            const Renderer = RING_RENDERERS[ring.type.kind];
            if (!Renderer) return null; // unknown kinds are skipped, not fatal
            return (
              <Renderer
                key={`ring-${ringIndex}`}
                ring={ring}
                ringIndex={ringIndex}
                layout={layout}
                colors={config.colors}
              />
            );
          })}
        </Group>
      </ChartPaintProvider>
    </Canvas>
  );
}
