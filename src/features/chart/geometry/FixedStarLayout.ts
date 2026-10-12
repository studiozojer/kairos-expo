import type { Placement } from '../config/engine-types';
/** Close stars share a marker/chooser. Astronomy stays at each member's true longitude. */
export interface StarMarker { id: string; longitude: number; placements: Placement[] }
export function fixedStarMarkers(placements: Placement[], radius: number, footprint: number, ringId: string): StarMarker[] {
  if (!placements.length || radius <= 0) return [];
  const sorted = [...placements].sort((a,b) => a.longitude - b.longitude || a.id.localeCompare(b.id));
  // Cut the circular ordering at the largest gap, so 359° and 1° cluster together.
  let cut = 0, largest = -1;
  sorted.forEach((star,i) => { const gap = (sorted[(i+1)%sorted.length].longitude - star.longitude + 360) % 360; if (gap > largest) { largest = gap; cut = (i+1)%sorted.length; } });
  const ordered = [...sorted.slice(cut), ...sorted.slice(0,cut)];
  const separation = Math.min(180, Math.max(footprint, 12) / radius * 180 / Math.PI);
  const clusters: { placements: Placement[]; angles: number[] }[] = [];
  let previous = ordered[0].longitude;
  ordered.forEach((star,i) => {
    const angle = i === 0 ? star.longitude : previous + ((star.longitude - previous + 720) % 360);
    const last = clusters.at(-1);
    if (last && angle - previous < separation) { last.placements.push(star); last.angles.push(angle); }
    else clusters.push({ placements: [star], angles: [angle] });
    previous = angle;
  });
  return clusters.map(cluster => ({ id: cluster.placements.length === 1 ? cluster.placements[0].id : `star-group:${ringId}:${cluster.placements.map(p => p.id).sort().join('|')}`,
    longitude: (cluster.angles.reduce((a,b) => a+b,0) / cluster.angles.length) % 360, placements: cluster.placements }));
}
