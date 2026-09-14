import { useMemo } from 'react';
import { Group, Path, Skia } from '@shopify/react-native-skia';
import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import type { WheelLayout } from './useWheelLayout';
import { findAspectPatterns, PATTERN_NAMES } from '../geometry/AspectPatterns';
import { useChartPaintTheme } from './colors';
export function PatternOverlay({ config, layout }: {
    config: ChartRenderingConfiguration;
    layout: WheelLayout;
}) {
    const theme = useChartPaintTheme();
    const paths = useMemo(() => {
        if (!config.aspects.showPatterns)
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
            return { key: `${pattern.name}:${pattern.points.map(p => p.id).sort().join(':')}`, path: builder.build() };
        });
    }, [config.rings, config.aspects, layout]);
    return <Group>{paths.map(({ key, path }) => <Group key={key}>
    <Path path={path} color={theme.color.txAccent} opacity={.08}/>
    <Path path={path} color={theme.color.txAccent} style="stroke" strokeWidth={1} opacity={.45}/>
  </Group>)}</Group>;
}
