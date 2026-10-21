import { Component, type ReactNode } from 'react';
import { Group, Rect, RoundedRect, Text, Skia, ImageFormat, drawAsPicture, loadData, type SkFont } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { fontMap, families } from '@/theme/fonts.gen';
import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import { CELESTIAL_BODIES, ZODIAC_SIGNS } from '../schema/enums.gen';
import { GLYPH_ASSETS, type GlyphName } from '../render/glyph-map.gen';
import { RenderAssetsContext, type LoadedGlyph, type RenderAssets } from '../render/assets';
import { ChartPaintProvider } from '../render/colors';
import { ChartWheelDrawing } from '../render/ChartWheel';
import { useWheelLayout } from '../render/useWheelLayout';
import { chartTargets, selectionPaint } from '../interaction/selection';
import { exportLayout, type ChartExportSnapshot, type ExportVariant } from './model';

class ExportBoundary extends Component<{ children: ReactNode; onError: (error: Error) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

const glyphCache = new Map<GlyphName, Promise<LoadedGlyph>>();
const fontCache = new Map<number, Promise<NonNullable<Awaited<ReturnType<typeof loadTypeface>>>>>();
async function loadTypeface(source: number) {
  const face = await loadData(source, data => Skia.Typeface.MakeFreeTypeFaceFromData(data));
  if (!face) throw new Error('Could not load a chart font.');
  return face;
}
export function requiredGlyphs(config: ChartRenderingConfiguration): GlyphName[] {
  const names = new Set<GlyphName>();
  const signs = () => ZODIAC_SIGNS.forEach(sign => names.add(`signs/${sign}` as GlyphName));
  for (const ring of config.rings) {
    if (ring.type.kind === 'zodiacSigns' || ring.type.kind === 'cuspAnnotations') signs();
    if (ring.type.kind === 'planets') {
      signs(); names.add('rx');
      ring.type.placements.forEach(p => names.add(`celestials/${p.glyphAsset}` as GlyphName));
    }
    if (ring.type.kind === 'fixedStars') { signs(); names.add('celestials/star'); }
    if (ring.type.kind === 'rulerSegments') ring.type.segments.forEach(segment => names.add(`celestials/${CELESTIAL_BODIES[segment.ruler]?.glyphAsset ?? segment.ruler}` as GlyphName));
  }
  return [...names];
}
export async function loadExportAssets(config: ChartRenderingConfiguration): Promise<RenderAssets> {
  const glyphs = await Promise.all(requiredGlyphs(config).map(async name => {
    let promise = glyphCache.get(name);
    if (!promise) {
      promise = (async () => {
        const source = GLYPH_ASSETS[name];
        if (source === undefined) throw new Error(`Unknown chart glyph: ${name}`);
        const svg = await loadData(source, data => Skia.SVG.MakeFromData(data));
        if (!svg) throw new Error(`Could not load chart glyph: ${name}`);
        const width = svg.width(), height = svg.height();
        if (!(width > 0 && height > 0)) throw new Error(`Invalid chart glyph: ${name}`);
        return { svg, width, height };
      })();
      glyphCache.set(name, promise);
      void promise.catch(() => glyphCache.delete(name));
    }
    return [name, await promise] as const;
  }));
  const typefaces = await Promise.all([fontMap[families.fraktion.book], fontMap[families.whyte.book]].map(async source => {
    let promise = fontCache.get(source);
    if (!promise) { promise = loadTypeface(source); fontCache.set(source, promise); void promise.catch(() => fontCache.delete(source)); }
    return [source, await promise] as const;
  }));
  return { glyphs: new Map(glyphs), typefaces: new Map(typefaces) };
}

function fittedText(text: string, font: SkFont, width: number) {
  if (font.measureText(text).width <= width) return text;
  const characters = Array.from(text);
  while (characters.length && font.measureText(`${characters.join('')}…`).width > width) characters.pop();
  return characters.length ? `${characters.join('')}…` : '';
}
function ExportDrawing({ snapshot, variant, assets }: { snapshot: ChartExportSnapshot; variant: ExportVariant; assets: RenderAssets }) {
  const frame = exportLayout(snapshot, variant);
  const layout = useWheelLayout(snapshot.config, frame.wheel);
  if (layout.feasible === false) throw new Error('This chart layout needs more room. Reduce ring widths before exporting.');
  const paint = selectionPaint(snapshot.selectedIds, chartTargets(layout), snapshot.config, snapshot.selectionStyle);
  const t = snapshot.theme;
  const face = assets.typefaces.get(fontMap[families.whyte.book])!;
  const heading = Skia.Font(face, t.type.whyteSm.fontSize), body = Skia.Font(face, t.type.whyteXs.fontSize), label = Skia.Font(face, t.type.whyteXxs.fontSize);
  const y = frame.wheel + 32;
  const cardWidth = (frame.width - 32 - (snapshot.cards.length - 1) * 8) / snapshot.cards.length;
  return <Group transform={[{ scale: 6 }]}>
    <Rect x={0} y={0} width={frame.width} height={frame.height} color={t.color.bgSolidBase} />
    <Group transform={[{ translateX: 4 }, { translateY: variant === 'wheel' ? 4 : 16 }]}>
      <ChartWheelDrawing config={snapshot.config} layout={layout} selection={paint} />
    </Group>
    {variant === 'full' && snapshot.cards.map((card, index) => {
      const x = 16 + index * (cardWidth + 8), textX = x + 11, textWidth = cardWidth - 22;
      const line = (font: SkFont, lineHeight: number, top: number) => top + (lineHeight - (font.getMetrics().descent - font.getMetrics().ascent)) / 2 - font.getMetrics().ascent;
      const contentTop = y + 9;
      return <Group key={card.id}>
        <RoundedRect x={x} y={y} width={cardWidth} height={frame.cardHeight} r={6} color={t.color.bgSolidCardSecondary} />
        <RoundedRect x={x + .5} y={y + .5} width={cardWidth - 1} height={frame.cardHeight - 1} r={6} color={t.color.bdSecondary} style="stroke" strokeWidth={1} />
        <Text text={fittedText(card.name, heading, textWidth - (snapshot.cards.length > 1 ? 14 : 0))} x={textX} y={line(heading,24,contentTop)} font={heading} color={t.color.txPrimary} />
        {snapshot.cards.length > 1 && <Text text={String(index+1)} x={x + cardWidth - 17} y={line(label,24,contentTop)} font={label} color={t.color.txTertiary} />}
        <Text text={fittedText(card.date,body,textWidth)} x={textX} y={line(body,16,contentTop + 28)} font={body} color={t.color.txSecondary} />
        <Text text={fittedText(card.time,body,textWidth)} x={textX} y={line(body,16,contentTop + 44)} font={body} color={t.color.txSecondary} />
        <Text text={fittedText(card.location,body,textWidth)} x={textX} y={line(body,16,contentTop + 60)} font={body} color={t.color.txTertiary} />
      </Group>;
    })}
  </Group>;
}

/** Native bitmap rendering never snapshots a UIKit/Android view. Glyphs and
 * typefaces are loaded first, so the shared drawing tree resolves synchronously. */
export async function renderChartExport(snapshot: ChartExportSnapshot, variant: ExportVariant, signal: AbortSignal): Promise<string> {
  if (signal.aborted) throw new Error('Export cancelled');
  const assets = await new Promise<RenderAssets>((resolve, reject) => {
    const onAbort = () => finish(() => reject(new Error('Export cancelled')));
    const timer = setTimeout(() => finish(() => reject(new Error('Chart images or fonts did not finish loading. Please try again.'))), 15000);
    const finish = (operation: () => void) => { clearTimeout(timer); signal.removeEventListener('abort', onAbort); operation(); };
    signal.addEventListener('abort', onAbort, { once: true });
    void loadExportAssets(snapshot.config).then(value => finish(() => resolve(value)), error => finish(() => reject(error)));
  });
  if (signal.aborted) throw new Error('Export cancelled');
  let renderError: Error | undefined;
  const picture = await drawAsPicture(<ExportBoundary onError={error => { renderError = error; }}><RenderAssetsContext.Provider value={assets}><ChartPaintProvider value={snapshot.theme}>
    <ExportDrawing snapshot={snapshot} variant={variant} assets={assets} />
  </ChartPaintProvider></RenderAssetsContext.Provider></ExportBoundary>);
  if (renderError) { picture.dispose(); throw renderError; }
  const frame = exportLayout(snapshot, variant);
  const surface = Skia.Surface.MakeOffscreen(frame.pixelWidth, frame.pixelHeight);
  if (!surface) { picture.dispose(); throw new Error('Not enough graphics memory to export this chart.'); }
  let uri: string | undefined;
  try {
    if (signal.aborted) throw new Error('Export cancelled');
    surface.getCanvas().drawPicture(picture); surface.flush();
    const image = surface.makeImageSnapshot();
    try {
      if (image.width() !== frame.pixelWidth || image.height() !== frame.pixelHeight) throw new Error('The chart image could not be rendered at its full resolution.');
      const bytes = image.encodeToBytes(ImageFormat.PNG,100);
      const file = new File(Paths.cache, `kairos-chart-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
      uri = file.uri; file.write(bytes);
      return uri;
    } finally { image.dispose(); }
  } catch (error) {
    if (uri) { const file = new File(uri); if (file.exists) file.delete(); }
    throw error;
  } finally { picture.dispose(); surface.dispose(); }
}
export function releaseChartExport(uri: string) { const file = new File(uri); if (file.exists) file.delete(); }

/** Check the encoded PNG header without decoding another full-size bitmap. */
export function chartExportSize(uri: string) {
  const handle = new File(uri).open();
  try {
    const bytes = handle.readBytes(24);
    if (bytes.length !== 24) throw new Error('The chart image file is incomplete.');
    const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (data.getUint32(0) !== 0x89504e47 || data.getUint32(4) !== 0x0d0a1a0a || data.getUint32(8) !== 13 || data.getUint32(12) !== 0x49484452) throw new Error('The chart image is not a valid PNG.');
    return { width: data.getUint32(16), height: data.getUint32(20) };
  } finally { handle.close(); }
}
