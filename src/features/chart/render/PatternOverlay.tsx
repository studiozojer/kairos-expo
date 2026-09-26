import { useMemo } from 'react';
import { DEFAULT_PATTERN_ORB } from '../schema/preset';
import { Group, Path, Skia } from '@shopify/react-native-skia';
import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import type { WheelLayout } from './useWheelLayout';
import type { Theme } from '@/theme';
import type { AspectOverlayStyle } from '../schema/ring-styles';
import { findAspectPatterns, PATTERN_NAMES, type PatternName } from '../geometry/AspectPatterns';
import { resolveColorValue, useChartPaintTheme, withAlphaFactor } from './colors';

const EMPTY_SELECTION: ReadonlySet<string> = new Set();

// Swift AspectOverlay+Patterns: fill only, using the defining aspect color.
const DEFINING_ASPECT = { 'Grand Trine': 'trine', 'T-square': 'square', 'Grand Cross': 'square',
    Yod: 'quincunx', Kite: 'trine',
    // Expo-only pattern: use the harmonious trine color, as for a kite.
    'Mystic Rectangle': 'trine' } as const satisfies Record<PatternName, string>;
/** Patterns may fade fully at the tolerance boundary; base zero always hides them. */
export function patternFillOpacity(base: number, weight: number, maxOrb: number, allowedOrb: number) {
    const closeness = maxOrb === 0 ? 1 : allowedOrb > 0 ? Math.max(0, 1 - maxOrb / allowedOrb) : 0;
    return base * (1 - weight + weight * closeness * closeness);
}
export function patternFillColor(name: PatternName, style: AspectOverlayStyle, theme: Theme, maxOrb = 0, allowedOrb = DEFAULT_PATTERN_ORB) {
    const base = style.colorMode === 'monochrome' ? resolveColorValue(style.monochromeColor, theme)
        : resolveColorValue({ source: 'hue', value: style.aspectHues[DEFINING_ASPECT[name]], layer: 'primitive' }, theme);
    return withAlphaFactor(base, patternFillOpacity(style.patternOpacity, style.patternOrbWeighting, maxOrb, allowedOrb));
}
export function PatternOverlay({ config, layout, selectedIdentifiers = EMPTY_SELECTION }: {
    config: ChartRenderingConfiguration;
    layout: WheelLayout;
    selectedIdentifiers?: ReadonlySet<string>;
}) {
    const theme = useChartPaintTheme();
    const paths = useMemo(() => {
        if (!config.aspects.enabled || !config.aspects.showPatterns)
            return [];
        const points = config.rings.flatMap(r => r.type.kind === 'planets' ? r.type.placements : []);
        const options = config.aspects.patterns ?? { enabledTypes: [...PATTERN_NAMES], orb: DEFAULT_PATTERN_ORB };
        const radius = layout.geometry.innerRadiusForRing(layout.ringThicknesses.length - 1);
        if (radius <= 0)
            return [];
        return findAspectPatterns(points, options.enabledTypes, options.orb).map(pattern => {
            const builder = Skia.PathBuilder.Make();
            [...pattern.points].sort((a, b) => a.longitude - b.longitude).forEach((p, i) => {
                const point = layout.coordinates.pointForDegree(p.longitude, radius);
                if (i === 0)
                    builder.moveTo(point.x, point.y);
                else
                    builder.lineTo(point.x, point.y);
            });
            builder.close();
            return { maxOrb: pattern.maxOrb, allowedOrb: options.orb, bodyIDs: pattern.points.map(p => p.id), name: pattern.name, key: `${pattern.name}:${pattern.points.map(p => p.id).sort().join(':')}`, path: builder.build() };
        });
    }, [config.rings, config.aspects, layout]);
    return <Group>{paths.filter(pattern => selectedIdentifiers.size === 0 || pattern.bodyIDs.every(id => selectedIdentifiers.has(id))).map(({ key, path, name, maxOrb, allowedOrb }) =>
        <Path key={key} path={path} style="fill" color={patternFillColor(name, layout.aspectOverlayStyle, theme, maxOrb, allowedOrb)} />
    )}</Group>;
}
