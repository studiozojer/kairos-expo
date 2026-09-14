export const PATTERN_NAMES = ['Grand Trine', 'T-square', 'Grand Cross', 'Yod', 'Kite', 'Mystic Rectangle'] as const;
export type PatternName = typeof PATTERN_NAMES[number];
/** Ideal longitudes encode every required pairwise relation, including diagonals.
 * Detection uses actual celestial longitude, never the collision-adjusted glyph. */
const TEMPLATES: Record<PatternName, readonly number[]> = {
    'Grand Trine': [0, 120, 240], 'T-square': [0, 90, 180],
    'Grand Cross': [0, 90, 180, 270], Yod: [0, 150, 210],
    Kite: [0, 120, 180, 240], 'Mystic Rectangle': [0, 60, 180, 240],
};
export interface PatternPoint {
    id: string;
    longitude: number;
}
export interface AspectPattern {
    name: PatternName;
    points: PatternPoint[];
}
const distance = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
export function findAspectPatterns(points: readonly PatternPoint[], enabled: readonly string[], orb: number): AspectPattern[] {
    if (!Number.isFinite(orb) || orb < 0 || orb > 15)
        return [];
    const unique = [...new Map(points.filter(p => Number.isFinite(p.longitude)).map(p => [p.id, p])).values()];
    const result: AspectPattern[] = [];
    for (const name of PATTERN_NAMES) {
        if (!enabled.includes(name))
            continue;
        const angles = TEMPLATES[name];
        const seen = new Set<string>();
        const visit = (chosen: PatternPoint[]) => {
            if (chosen.length === angles.length) {
                const key = JSON.stringify(chosen.map(p => p.id).sort());
                if (!seen.has(key)) {
                    seen.add(key);
                    result.push({ name, points: [...chosen] });
                }
                return;
            }
            for (const point of unique) {
                if (chosen.some(p => p.id === point.id))
                    continue;
                if (!chosen.every((p, i) => Math.abs(distance(point.longitude, p.longitude) - distance(angles[chosen.length], angles[i])) <= orb + 1e-9))
                    continue;
                visit([...chosen, point]);
            }
        };
        visit([]);
    }
    return result;
}
