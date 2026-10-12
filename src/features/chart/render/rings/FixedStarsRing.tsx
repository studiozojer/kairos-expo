import { Circle, Group, Line, Path, Skia, Text, useFont } from '@shopify/react-native-skia';
import { families, fontMap } from '@/theme/fonts.gen';
import { FIXED_STARS_STYLE_DEFAULT, FIXED_STARS_STYLE_TYPE } from '../../schema/ring-styles';
import { selectionColor, selectionOpacity } from '../../interaction/selection';
import type { RingRendererProps } from '../ChartWheel';
import { resolveColorValue, useChartPaintTheme } from '../colors';
import { Glyph } from '../Glyph';
import { FIXED_STARS_CONTENT_TYPE } from '../../schema/ring-content';
import { ZODIAC_SIGNS } from '../../schema/enums.gen';
const symbols = ['♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'];
export function FixedStarsRing({ ring, ringIndex, layout, selection }: RingRendererProps) {
  const theme = useChartPaintTheme();
  const style = ring.style.$type === FIXED_STARS_STYLE_TYPE ? ring.style : FIXED_STARS_STYLE_DEFAULT;
  const font = useFont(fontMap[families.fraktion.book],style.textSize);
  const { geometry, coordinates } = layout;
  const outer = geometry.radiusForRing(ringIndex), inner = geometry.innerRadiusForRing(ringIndex), mid = geometry.midRadiusForRing(ringIndex);
  const glyphSize = Math.min(style.glyphSize,Math.max(1,outer-inner-2));
  const background = Skia.PathBuilder.Make(); background.addCircle(coordinates.center.x,coordinates.center.y,outer); background.addCircle(coordinates.center.x,coordinates.center.y,inner);
  const color = style.glyphColor ? resolveColorValue(style.glyphColor,theme) : theme.color.icPrimary;
  const textColor = style.textColor ? resolveColorValue(style.textColor,theme) : color;
  const boundary = style.boundaryLineColor ? resolveColorValue(style.boundaryLineColor,theme) : theme.color.bdPrimary;
  const content = ring.content?.$type === FIXED_STARS_CONTENT_TYPE ? ring.content : undefined;
  return <Group>
    {style.backgroundColor && <Path path={background.build()} fillType="evenOdd" color={resolveColorValue(style.backgroundColor,theme)} />}
    {style.outerBoundaryLineWidth > 0 && <Circle cx={coordinates.center.x} cy={coordinates.center.y} r={outer} color={boundary} style="stroke" strokeWidth={style.outerBoundaryLineWidth} />}
    {style.innerBoundaryLineWidth > 0 && <Circle cx={coordinates.center.x} cy={coordinates.center.y} r={inner} color={boundary} style="stroke" strokeWidth={style.innerBoundaryLineWidth} />}
    {(layout.starLayouts?.get(ringIndex) ?? []).map(marker => {
      const point = coordinates.pointForDegree(marker.longitude,mid);
      const active = marker.placements.find(p => selection?.selected.has(p.id)) ?? marker.placements.find(p => selection?.related.has(p.id)) ?? marker.placements[0];
      const selected = marker.placements.some(p => selection?.selected.has(p.id));
      const annotation = marker.placements.length > 1 ? String(marker.placements.length) : content ? [content.showDegrees ? `${Math.floor(active.longitude%30)}°` : '',content.showSign ? symbols[ZODIAC_SIGNS.findIndex(sign => sign === active.signPlacement.toLowerCase())] ?? '' : '',content.showMinutes ? `${String(Math.floor(active.longitude%1*60)).padStart(2,'0')}′` : ''].join('') : '';
      const textPoint = coordinates.pointForDegree(marker.longitude,Math.min(outer-style.textSize/2,mid+glyphSize/2+style.textOffset));
      return <Group key={marker.id}>
        {marker.placements.map(p => <Line key={p.id} p1={coordinates.pointForDegree(p.longitude,inner)} p2={coordinates.pointForDegree(p.longitude,inner+Math.min(3*layout.displayScale,(outer-inner)/4))} color={color} strokeWidth={.75*layout.displayScale} opacity={selectionOpacity(selection,p.id,'affectsDegreeMarks')} />)}
        {marker.placements.length > 1 && marker.placements.map(p => <Line key={`connection:${p.id}`} p1={coordinates.pointForDegree(p.longitude,inner)} p2={point} color={boundary} strokeWidth={.5*layout.displayScale} opacity={selectionOpacity(selection,p.id,'affectsDegreeMarks')} />)}
        {selected && selection?.style.showBackgroundCircle && <Circle cx={point.x} cy={point.y} r={glyphSize*.9} color={theme.color.bgSecondary} opacity={.5} />}
        <Group origin={point} transform={style.rotateGlyphs ? [{ rotate: coordinates.zodiacToCanvasAngle(marker.longitude-90)*Math.PI/180 }] : []}>
          <Glyph name="celestials/star" x={point.x} y={point.y} size={glyphSize} color={selectionColor(selection,active.id,'affectsGlyphs',color,theme)} selected={selected} opacity={selectionOpacity(selection,active.id,'affectsGlyphs')} />
        </Group>
        {annotation && font ? <Text text={annotation} x={textPoint.x-font.measureText(annotation).width/2} y={textPoint.y+style.textSize*.35} font={font} color={selectionColor(selection,active.id,'affectsDegreeText',textColor,theme)} opacity={selectionOpacity(selection,active.id,'affectsDegreeText')} /> : null}
      </Group>;
    })}
  </Group>;
}
