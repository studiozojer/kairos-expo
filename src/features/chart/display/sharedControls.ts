import type { Preset } from '../schema/preset';
import { PLANETS_STYLE_TYPE, type PlanetsRingStyle } from '../schema/ring-styles';
export const CHART_SLOTS = ['soloChart', 'dualChart', 'tripleChart'] as const;
export const LABEL_CONTROLS = [
    ['showDegreeText', 'Degrees'], ['showMinuteText', 'Minutes'],
    ['showSignGlyph', 'Sign symbols'], ['showRetrogradeGlyph', 'Retrograde markers'],
] as const;
export function planetStyles(preset: Preset): PlanetsRingStyle[] {
    return CHART_SLOTS.flatMap(slot => preset[slot].rings.flatMap(ring => ring.type === 'planets' && ring.style.$type === PLANETS_STYLE_TYPE ? [ring.style] : []));
}
export function updatePlanetStyles(preset: Preset, changes: Partial<PlanetsRingStyle>): Preset {
    const next = { ...preset };
    for (const slot of CHART_SLOTS) {
        next[slot] = { ...preset[slot], rings: preset[slot].rings.map(ring => ring.type === 'planets' && ring.style.$type === PLANETS_STYLE_TYPE
                ? { ...ring, style: { ...ring.style, ...changes } } : ring) };
    }
    return next;
}
export function updateOrientation(preset: Preset, degree: number): Preset {
    const next = { ...preset };
    for (const slot of CHART_SLOTS)
        next[slot] = {
            ...preset[slot], globalSettings: { ...preset[slot].globalSettings, staticOrientationDegree: degree },
        };
    return next;
}
