import { useRenderFont } from "../assets";
import { families, fontMap } from '@/theme/fonts.gen';
import { Circle, Group, Path, Skia, Text } from '@shopify/react-native-skia';
import { CELESTIAL_BODIES } from '../../schema/enums.gen';
import { rulerGlyphSize, segmentIdentifier } from '../../geometry/RulerSegments';
import { selectionColor, selectionOpacity } from '../../interaction/selection';
import type { RingRendererProps } from '../ChartWheel';
import { Glyph } from '../Glyph';
import type { GlyphName } from '../glyph-map.gen';
import { celestialBodyColor, resolveColorValue, useChartPaintTheme } from '../colors';
import { segmentPath } from './ZodiacSignsRing';
export function RulerSegmentsRing({ ring, ringIndex, layout, colors, selection }: RingRendererProps) {
  const theme = useChartPaintTheme();
  const numberSize = ring.type.kind === 'rulerSegments' && 'numberFontSize' in ring.style
    ? rulerGlyphSize(ring.type.segments, layout.geometry.innerRadiusForRing(ringIndex) + layout.ringThicknesses[ringIndex] * .25, layout.ringThicknesses[ringIndex] * .5, ring.style.numberFontSize) : 10;
  const font = useRenderFont(fontMap[families.fraktion.book], Math.max(.1,numberSize));
  if (ring.type.kind !== 'rulerSegments' || !('glyphSize' in ring.style) || !('outerBoundaryWidth' in ring.style)) return null;
  const style = ring.style;
  const { coordinates, geometry } = layout;
  const outer = geometry.radiusForRing(ringIndex), inner = geometry.innerRadiusForRing(ringIndex), mid = geometry.midRadiusForRing(ringIndex);
  const { segments, showNumbers } = ring.type;
  const glyphRadius = showNumbers ? inner + (outer - inner) * .7 : mid;
  const size = rulerGlyphSize(segments, glyphRadius, (outer - inner) * (showNumbers ? .5 : 1), style.glyphSize);
  const boundary = style.boundaryLineColor ? resolveColorValue(style.boundaryLineColor, theme) : theme.color.bdPrimary;
  return <Group>
    {segments.map(segment => {
      const id = segmentIdentifier(ring.id ?? String(ringIndex), segment.index);
      const degree = (segment.start + segment.end) / 2;
      const position = coordinates.pointForDegree(degree, glyphRadius);
      const start = coordinates.zodiacToCanvasAngle(segment.start);
      const end = start - (segment.end - segment.start);
      const builder = Skia.PathBuilder.Make();
      const a = coordinates.pointForDegree(segment.start, outer), b = coordinates.pointForDegree(segment.start, inner);
      builder.moveTo(a.x,a.y); builder.lineTo(b.x,b.y);
      const color = style.glyphColor ? resolveColorValue(style.glyphColor, theme) : celestialBodyColor(segment.ruler,colors,theme);
      const numberPosition = coordinates.pointForDegree(degree, inner + (outer - inner) * .25);
      const number = String(segment.index % 3 + 1);
      const numberWidth = font?.measureText(number).width ?? 0;
      const glyph = <Glyph name={`celestials/${CELESTIAL_BODIES[segment.ruler]?.glyphAsset ?? segment.ruler}` as GlyphName} x={position.x} y={position.y} size={size}
        selected={selection?.selected.has(id)} opacity={selectionOpacity(selection,id,'affectsGlyphs')} color={selectionColor(selection,id,'affectsGlyphs',color,theme)} />;
      return <Group key={id}>
        {style.backgroundColor && <Path path={segmentPath(coordinates.center.x,coordinates.center.y,outer,inner,start,end)} color={resolveColorValue(style.backgroundColor,theme)} />}
        {style.boundaryLineWidth > 0 && <Path path={builder.build()} style="stroke" strokeWidth={style.boundaryLineWidth} color={boundary} />}
        {showNumbers && font && <Text text={number} font={font} x={numberPosition.x - numberWidth / 2} y={numberPosition.y - (font.getMetrics().ascent + font.getMetrics().descent) / 2} color={'numberTextColor' in style && style.numberTextColor ? resolveColorValue(style.numberTextColor,theme) : color} opacity={selectionOpacity(selection,id,'affectsDegreeText')} />}
        {style.rotateGlyphs ? <Group origin={position} transform={[{ rotate: coordinates.zodiacToCanvasAngle(degree - 90) * Math.PI / 180 }]}>{glyph}</Group> : glyph}
      </Group>;
    })}
    {style.outerBoundaryWidth > 0 && <Circle cx={coordinates.center.x} cy={coordinates.center.y} r={outer} style="stroke" strokeWidth={style.outerBoundaryWidth} color={boundary} />}
    {style.innerBoundaryWidth > 0 && <Circle cx={coordinates.center.x} cy={coordinates.center.y} r={inner} style="stroke" strokeWidth={style.innerBoundaryWidth} color={boundary} />}
  </Group>;
}
