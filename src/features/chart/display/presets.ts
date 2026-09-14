import { parsePreset, type Preset } from "../schema/preset";

import classic from "../fixtures/presets/classic.json";
import minimal from "../fixtures/presets/minimal.json";
import modern from "../fixtures/presets/modern.json";
import starfield from "../fixtures/presets/starfield.json";
import study from "../fixtures/presets/study.json";
import traditional from "../fixtures/presets/traditional.json";
import transits from "../fixtures/presets/transits.json";

/**
 * The seven bundled preset templates, as a stable name→parsed-Preset registry.
 *
 * The fixtures are byte-verbatim copies of KairosCore PresetTemplates
 * (see schema/preset.ts header); parsing is tolerant, so a bad blob degrades
 * to PRESET_DEFAULT rather than throwing. Display order is a product choice,
 * not the directory's alphabetical order — classic first (the current default),
 * then the display-first variants, study/traditional (the deep, ring-dense
 * ones) last.
 */

export interface BundledPreset {
  /** Stable key (matches the fixture filename), used as the picker id. */
  name: string;
  /** The parsed preset. */
  preset: Preset;
}

const RAW: Readonly<Record<string, unknown>> = {
  classic,
  minimal,
  modern,
  starfield,
  study,
  traditional,
  transits,
};

export const BUNDLED_PRESET_NAMES: readonly string[] = [
  "classic",
  "minimal",
  "modern",
  "starfield",
  "study",
  "traditional",
  "transits",
];

/** Parse one bundled preset by name (undefined for an unknown name). */
export function bundledPreset(name: string): BundledPreset | undefined {
  const raw = RAW[name];
  if (raw === undefined) return undefined;
  return { name, preset: parsePreset(raw) };
}
