import { parsePreset, serializePreset, type Preset } from '../schema/preset';
/** Keep the portable source alongside its rendering projection. Editing known
 * controls must not rewrite metadata or extensions owned by other consumers. */
export interface PresetDocument {
    source: unknown;
    preset: Preset;
}
export function presetDocument(source: unknown): PresetDocument {
    return { source, preset: parsePreset(source) };
}
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
function patch(source: unknown, before: unknown, after: unknown): unknown {
    if (JSON.stringify(before) === JSON.stringify(after))
        return source;
    if (record(before) && record(after)) {
        const result = { ...(record(source) ? source : {}) };
        for (const key of Object.keys(after)) {
            if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
                result[key] = patch(result[key], before[key], after[key]);
            }
        }
        return result;
    }
    // Ring edits retain order and identity. Other arrays are intentional set edits.
    if (Array.isArray(before) && Array.isArray(after) && Array.isArray(source)
        && before.length === after.length && before.length === source.length
        && before.every((v, i) => record(v) && record(after[i]) && v.id === after[i].id)) {
        return after.map((v, i) => patch(source[i], before[i], v));
    }
    return after;
}
export function editPresetDocument(document: PresetDocument, next: Preset): PresetDocument {
    return {
        source: patch(document.source, serializePreset(document.preset), serializePreset(next)),
        preset: next,
    };
}
