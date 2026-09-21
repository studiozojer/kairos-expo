import { useMemo } from 'react';
import { Group, Path, Skia } from '@shopify/react-native-skia';
import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import type { WheelLayout } from './useWheelLayout';
import type { Theme } from '@/theme';
import type { AspectOverlayStyle } from '../schema/ring-styles';
import { findAspectPatterns, PATTERN_NAMES, type PatternName } from '../geometry/AspectPatterns';
import { resolveColorValue, useChartPaintTheme, withAlphaFactor } from './colors';

// Swift AspectOverlay+Patterns: fill only, using the defining aspect color.
const DEFINING_ASPECT = { 'Grand Trine': 'trine', 'T-square': 'square', 'Grand Cross': 'square',
    Yod: 'quincunx', Kite: 'trine',
    // Expo-only pattern: use the harmonious trine color, as for a kite.
    'Mystic Rectangle': 'trine' } as const satisfies Record<PatternName, string>;
export function patternFillColor(name: PatternName, style: AspectOverlayStyle, theme: Theme) {
    const base = style.colorMode === 'monochrome' ? resolveColorValue(style.monochromeColor, theme)
        : resolveColorValue({ source: 'hue', value: style.aspectHues[DEFINING_ASPECT[name]], layer: 'primitive' }, theme);
    return withAlphaFactor(base, .08);
}
export function PatternOverlay({ config, layout, hasSelection = false }: {
    config: ChartRenderingConfiguration;
    layout: WheelLayout;
    hasSelection?: boolean;
}) {
    const theme = useChartPaintTheme();
    const paths = useMemo(() => {
        if (!config.aspects.enabled || !config.aspects.showPatterns || hasSelection)
            return [];
        const points = config.rings.flatMap(r => r.type.kind === 'planets' ? r.type.placements : []);
        const options = config.aspects.patterns ?? { enabledTypes: [...PATTERN_NAMES], orb: 5 };
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
            return { name: pattern.name, key: `${pattern.name}:${pattern.points.map(p => p.id).sort().join(':')}`, path: builder.build() };
        });
    }, [config.rings, config.aspects, layout, hasSelection]);
    return <Group>{paths.map(({ key, path, name }) =>
        <Path key={key} path={path} style="fill" color={patternFillColor(name, layout.aspectOverlayStyle, theme)} />
    )}</Group>;
}
