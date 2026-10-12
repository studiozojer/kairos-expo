import { createRing, RING_KINDS, type DisplayPreset } from './model';
import { displayTemplate, TEMPLATE_NAMES } from './templates';
import { PATTERN_NAMES } from '../geometry/AspectPatterns';
import { ASPECT_ORBS_DEFAULT } from '../schema/ring-content';
import { CELESTIAL_BODIES } from '../schema/enums.gen';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (path: string): never => { throw new Error(`Invalid display preset: ${path}`); };
const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
/** Validate types and ranges before any value reaches geometry or a loop. */
function shape(value: unknown, expected: unknown, path: string) {
  if (typeof expected === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail(path);
    const n = value as number, key = path.split('.').at(-1)!;
    if (n < 0 || n > 4096) fail(path);
    if (/opacity/i.test(key) && n > 1) fail(path);
    if (/orbWeighting/i.test(key) && n > (key === 'orbWeighting' ? 3 : 1)) fail(path);
    if (/MarkInterval$/.test(key) && (n < .25 || n > 30)) fail(path);
    if (/(glyphSize|FontSize|textSize|circleRadius)$/.test(key) && n <= 0) fail(path);
    return;
  }
  if (typeof expected === 'boolean') { if (typeof value !== 'boolean') fail(path); return; }
  if (typeof expected === 'string') { if (typeof value !== 'string') fail(path); return; }
  if (Array.isArray(expected)) { if (!Array.isArray(value)) fail(path); (value as unknown[]).forEach((v,i) => shape(v, expected[0] ?? '', `${path}.${i}`)); return; }
  if (!object(value) || !object(expected)) fail(path);
  for (const [key, v] of Object.entries(expected as Record<string, unknown>)) if (v !== undefined) shape((value as Record<string, unknown>)[key], v, `${path}.${key}`);
}
function numbers(value: unknown, path: string) {
  if (typeof value === 'number' && !Number.isFinite(value)) fail(path);
  if (object(value)) for (const [key,v] of Object.entries(value)) numbers(v, `${path}.${key}`);
  if (Array.isArray(value)) value.forEach((v,i) => numbers(v, `${path}.${i}`));
}
const enums: Record<string, string[]> = {
  system: ['traditional','modern','chaldean','triplicity','egyptian','ptolemaic'],
  colorMode: ['byType','byCelestial','monochrome'], renderMode: ['straight','bezier'],
  lineCap: ['butt','round','square'],
  source: ['semantic','hex','hue'], variant: ['minimal','coloredBackground','coloredForeground','fullHue','subtle','greyscale'],
};
function knownEnums(value: unknown, path: string) {
  if (!object(value)) return;
  if ('source' in value && (typeof value.value !== 'string' || (value.layer !== undefined && !['ic','tx','bg','bd','primitive'].includes(value.layer as string)))) fail(path);
  for (const [key,v] of Object.entries(value)) {
    if (enums[key] && (typeof v !== 'string' || !enums[key].includes(v))) fail(`${path}.${key}`);
    if (key === 'source' && v === 'hex' && (typeof value.value !== 'string' || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value.value))) fail(path);
    if (object(v)) knownEnums(v, `${path}.${key}`);
    if (Array.isArray(v)) v.forEach((item,i) => knownEnums(item, `${path}.${key}.${i}`));
  }
}
export function validateDisplayPreset(value: unknown): asserts value is DisplayPreset {
  if (!object(value) || value.schemaVersion !== 1 || !uuid(value.id) || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 100 || (value.templateId !== undefined && !TEMPLATE_NAMES.includes(value.templateId as typeof TEMPLATE_NAMES[number]))) fail('identity/version');
  const record = value as Record<string, unknown>;
  const baseline = displayTemplate('classic')!;
  shape(record.colors, baseline.colors, 'colors'); shape(record.visibility, baseline.visibility, 'visibility');
  shape(record.selection, baseline.selection, 'selection'); shape(record.aspectOverlay, baseline.aspectOverlay, 'aspectOverlay');
  shape(record.aspects, baseline.aspects, 'aspects');
  const preset = value as unknown as DisplayPreset;
  const bodies = new Set(Object.values(CELESTIAL_BODIES).map(body => body.displayName));
  if (preset.visibility.enabledBodies.some(body => !bodies.has(body))) fail('visibility');
  if (!object(preset.orientation) || !['static','ascendant'].includes(preset.orientation.mode) || !Number.isFinite(preset.orientation.degree) || preset.orientation.degree < 0 || preset.orientation.degree >= 360) fail('orientation');
  if (!object(preset.layouts)) fail('layouts');
  const ids = new Set<string>();
  for (const count of [1,2,3] as const) {
    const layout = preset.layouts[count];
    if (!object(layout) || !Array.isArray(layout.rings) || layout.rings.length > 9) fail(`layout ${count}`);
    shape(layout.geometry, baseline.layouts[count].geometry, 'geometry');
    if (!object(layout.geometry.moduleHitRadiusOverrides) || Object.values(layout.geometry.moduleHitRadiusOverrides).some(v => !Number.isFinite(v) || v < 0 || v > 100)) fail('hit radii');
    const kinds = new Set<string>(), sources = new Set<number>();
    for (const ring of layout.rings) {
      if (!object(ring) || !uuid(ring.id) || ids.has(ring.id) || !RING_KINDS.includes(ring.kind) || typeof ring.enabled !== 'boolean') fail('ring identity/kind');
      ids.add(ring.id);
      if (!object(ring.thickness) || !['auto','fixed'].includes(ring.thickness.kind) || (ring.thickness.kind === 'fixed' && (!Number.isFinite(ring.thickness.value) || ring.thickness.value < 5 || ring.thickness.value > 150))) fail('thickness');
      const expected = createRing(ring.kind,1,'00000000-0000-4000-8000-000000000000');
      shape(ring.style, expected.style, `${ring.kind}.style`); shape(ring.options, expected.options, `${ring.kind}.options`);
      // Reject fields from another ring kind, rather than retaining invisible knobs.
      for (const [key,v] of Object.entries(ring.style)) {
        if (typeof v === 'number' && (v < 0 || v > 4096)) fail(key);
        if (/Color$/.test(key) && v !== undefined && (!object(v) || !['semantic','hue','hex'].includes(v.source as string) || typeof v.value !== 'string')) fail(key);
      }
      const keys = new Set(Object.keys(expected.style));
      if (Object.keys(ring.style).some(key => !keys.has(key)) || Object.keys(ring.options).some(key => !Object.hasOwn(expected.options,key))) fail('ring fields');
      if ('sourceSlot' in expected) {
        if (!('sourceSlot' in ring) || !Number.isInteger(ring.sourceSlot) || ring.sourceSlot < 1 || ring.sourceSlot > count) fail('source slot');
      } else if ('sourceSlot' in ring) fail('shared ring source');
      if (ring.kind === 'planets') {
        if (sources.has(ring.sourceSlot)) fail('duplicate planet source'); sources.add(ring.sourceSlot);
      } else { if (kinds.has(ring.kind)) fail('duplicate ring kind'); kinds.add(ring.kind); }
      if ('system' in ring.options && !(['signRulers','decans','terms'].includes(ring.kind) && ({signRulers:['traditional','modern'],decans:['chaldean','triplicity','modern'],terms:['egyptian','ptolemaic','chaldean']} as Record<string,string[]>)[ring.kind].includes(ring.options.system))) fail('rulership system');
    }
    if (sources.size !== count) fail('managed planet sources');
  }
  const aspects = preset.aspects;
  if (aspects.enabledTypes.some(type => !Object.hasOwn(ASPECT_ORBS_DEFAULT.orbs,type)) || Object.entries(aspects.orbs.orbs).some(([key,v]) => !Object.hasOwn(ASPECT_ORBS_DEFAULT.orbs,key) || !Number.isFinite(v) || v < 0 || v > 15)) fail('aspect orbs');
  if (aspects.patterns && (aspects.patterns.enabledTypes.some(type => !(PATTERN_NAMES as readonly string[]).includes(type)) || aspects.patterns.orb < 0 || aspects.patterns.orb > 15)) fail('patterns');
  if (preset.colors.zodiacColors.zodiacHues.signs.length !== 12) fail('zodiac colors');
  if (preset.aspectOverlay.bezierCurveStrength > 1 || preset.aspectOverlay.minimumStrength > 1 || !Number.isInteger(preset.aspectOverlay.maximumAspectCount) || preset.aspectOverlay.dashPattern.some(length => length < 0)) fail('overlay ranges');
  numbers(value, 'preset'); knownEnums(value, 'preset');
}
