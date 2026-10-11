import type { DisplayPreset } from './model';
import classic from './templates/classic.json';
import minimal from './templates/minimal.json';
import modern from './templates/modern.json';
import starfield from './templates/starfield.json';
import study from './templates/study.json';
import traditional from './templates/traditional.json';
import transits from './templates/transits.json';
export const TEMPLATE_NAMES = ['classic','minimal','modern','starfield','study','traditional','transits'] as const;
const templates = { classic, minimal, modern, starfield, study, traditional, transits };
export function displayTemplate(id: string): DisplayPreset | undefined {
  if (!Object.prototype.hasOwnProperty.call(templates, id)) return undefined;
  return JSON.parse(JSON.stringify(templates[id as keyof typeof templates]));
}
