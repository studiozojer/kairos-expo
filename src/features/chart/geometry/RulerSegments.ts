import terms from '../display/terms-data.json';
import type { CelestialBodyId } from '../schema/enums.gen';
export interface RulerSegment { index: number; start: number; end: number; ruler: CelestialBodyId; label: string }
const traditional = ['mars','venus','mercury','moon','sun','mercury','venus','mars','jupiter','saturn','saturn','jupiter'];
const modern = [...traditional]; modern[7] = 'pluto'; modern[10] = 'uranus'; modern[11] = 'neptune';
const chaldean = ['mars','sun','venus','mercury','moon','saturn','jupiter'];
export function signRuler(index: number, system: 'traditional' | 'modern' = 'traditional') { return (system === 'modern' ? modern : traditional)[((index % 12) + 12) % 12]; }
export function rulerSegments(kind: 'signRulers' | 'decans' | 'terms', system: string): RulerSegment[] {
  if (kind === 'signRulers') return Array.from({ length: 12 }, (_,index) => ({ index, start: index * 30, end: (index + 1) * 30, ruler: signRuler(index, system as 'traditional' | 'modern'), label: 'Sign ruler' }));
  if (kind === 'decans') return Array.from({ length: 36 }, (_,index) => ({ index, start: index * 10, end: (index + 1) * 10,
    ruler: system === 'chaldean' ? chaldean[index % 7] : signRuler((Math.floor(index / 3) + (index % 3) * 4) % 12, system === 'modern' ? 'modern' : 'traditional'), label: `Decan ${index % 3 + 1}` }));
  const orders = [['jupiter','venus','saturn','mercury','mars'],['venus','mercury','jupiter','saturn','mars'],['mercury','venus','jupiter','mars','saturn'],['mars','venus','jupiter','mercury','saturn']];
  return Array.from({ length: 12 }, (_,sign) => {
    const boundaries = [0,8,15,21,26,30];
    const table = system === 'chaldean' ? orders[sign % 4].map((ruler,i) => [boundaries[i],boundaries[i+1],ruler]) : terms[system as keyof typeof terms][sign];
    return table.map(([start,end,ruler],i) => ({ index: sign * 5 + i, start: sign * 30 + Number(start), end: sign * 30 + Number(end), ruler: String(ruler), label: `Term ${i + 1}` }));
  }).flat();
}
export const segmentIdentifier = (ringId: string, index: number) => `segment:${ringId}:${index}`;
/** One uniform ruler size, bounded by the narrowest segment and the band. */
export function rulerGlyphSize(segments: RulerSegment[], midRadius: number, thickness: number, requested: number) {
  const smallestArc = Math.min(...segments.map(segment => segment.end - segment.start)) * Math.PI / 180 * midRadius;
  return Math.max(0, Math.min(requested, smallestArc * .7, thickness * .8));
}
