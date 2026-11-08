import type { Point } from './types';

export interface LabelBox { x: number; y: number; width: number; height: number }
export interface AngleLabelInput { id: string; longitude: number; radius: number; width: number; height: number }
export interface AngleLabelLayout { id: string; center: Point; box: LabelBox; collisions: number; displaced: boolean }
export function boxesOverlap(a: LabelBox, b: LabelBox): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Bounded, deterministic candidate search. True axis positions never move;
 * only annotations move, with a leader back to the actual longitude.
 * Unresolved collisions are returned, not disguised as successful layout. */
export function layoutAngleLabels(inputs: AngleLabelInput[], point: (degree: number, radius: number) => Point,
  size: number, obstacles: LabelBox[], padding: number): AngleLabelLayout[] {
  const occupied = [...obstacles];
  return inputs.map(input => {
    const anchor = point(input.longitude, input.radius);
    let best: AngleLabelLayout | undefined;
    let bestCost = Infinity;
    const offsets = [0, 2, -2, 4, -4, 8, -8, 12, -12, 18, -18, 24, -24];
    for (const offset of offsets) {
      const raw = point(input.longitude + offset, input.radius);
      const center = {
        x: Math.max(padding + input.width / 2, Math.min(size - padding - input.width / 2, raw.x)),
        y: Math.max(padding + input.height / 2, Math.min(size - padding - input.height / 2, raw.y)),
      };
      const box = { x: center.x - input.width / 2, y: center.y - input.height / 2, width: input.width, height: input.height };
      const collisions = occupied.filter(other => boxesOverlap(box, other)).length;
      const distance = Math.hypot(center.x - anchor.x, center.y - anchor.y);
      const cost = collisions * size * 100 + distance;
      if (cost < bestCost) {
        bestCost = cost;
        best = { id: input.id, center, box, collisions, displaced: distance > 1 };
      }
    }
    occupied.push(best!.box);
    return best!;
  });
}
