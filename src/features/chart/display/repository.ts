import { copyPreset, type DisplayPreset } from './model';
import { displayTemplate, TEMPLATE_NAMES } from './templates';
import { validateDisplayPreset } from './validation';
export const DISPLAY_PRESETS_KEY = 'kairos.display-presets.v1';
export interface PresetStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export interface PresetCollection { version: 1; selected: string; custom: DisplayPreset[] }
export interface PresetState extends PresetCollection { loaded: boolean; loadError: boolean; saveError: boolean }
const initial = (): PresetCollection => ({ version: 1, selected: 'classic', custom: [] });
export function parseCollection(raw: string | null): PresetCollection {
  if (raw === null) return initial();
  const value = JSON.parse(raw) as PresetCollection;
  if (!value || value.version !== 1 || !Array.isArray(value.custom) || typeof value.selected !== 'string') throw new Error('Invalid preset storage');
  const ids = new Set<string>();
  value.custom.forEach(preset => {
    preset.selection = Object.assign({ includeConjunctFixedStars: false, conjunctFixedStarsOrb: 1 }, preset.selection);
    validateDisplayPreset(preset);
    if (ids.has(preset.id)) throw new Error('Duplicate preset identity'); ids.add(preset.id);
  });
  if (!displayTemplate(value.selected) && !ids.has(value.selected)) throw new Error('Missing selected preset');
  return value;
}
/** One owner and a serialized write queue. Read failures never authorize writes. */
export class PresetRepository {
  state: PresetState = { ...initial(), loaded: false, loadError: false, saveError: false };
  private templates = new Map(TEMPLATE_NAMES.map(id => [id as string, displayTemplate(id)!]));
  private listeners = new Set<() => void>();
  private queue = Promise.resolve();
  private generation = 0;
  private reading?: Promise<void>;
  constructor(private storage: PresetStorage) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { this.listeners.forEach(listener => listener()); }
  get preset(): DisplayPreset { return this.state.custom.find(preset => preset.id === this.state.selected) ?? this.templates.get(this.state.selected)!; }
  get choices() { return [...TEMPLATE_NAMES.map(id => ({ id, name: displayTemplate(id)!.name })), ...this.state.custom.map(preset => ({ id: preset.id, name: preset.name }))]; }
  load(): Promise<void> {
    if (this.state.loaded) return Promise.resolve();
    if (this.reading) return this.reading;
    this.reading = this.storage.getItem(DISPLAY_PRESETS_KEY).then(raw => {
      this.state = { ...parseCollection(raw), loaded: true, loadError: false, saveError: false }; this.emit();
    }).catch(() => { this.state = { ...this.state, loadError: true }; this.emit(); })
      .finally(() => { this.reading = undefined; });
    return this.reading;
  }
  private write(collection: PresetCollection) {
    parseCollection(JSON.stringify(collection));
    const generation = ++this.generation;
    this.state = { ...collection, loaded: true, loadError: false, saveError: false }; this.emit();
    const payload = JSON.stringify(collection);
    this.queue = this.queue.then(() => this.storage.setItem(DISPLAY_PRESETS_KEY, payload)).then(() => {
      if (generation === this.generation) { this.state = { ...this.state, saveError: false }; this.emit(); }
    }, () => {
      if (generation === this.generation) { this.state = { ...this.state, saveError: true }; this.emit(); }
    });
    return this.queue;
  }
  private ready() { if (!this.state.loaded || this.state.loadError) throw new Error('Restore presets before editing'); }
  private collection(): PresetCollection { return { version: 1, selected: this.state.selected, custom: this.state.custom }; }
  select(id: string) { this.ready(); if (!this.choices.some(choice => choice.id === id)) throw new Error('Unknown preset'); return this.write({ ...this.collection(), selected: id }); }
  update(preset: DisplayPreset) {
    this.ready(); validateDisplayPreset(preset);
    if (preset.id !== this.preset.id) throw new Error('Stale preset edit');
    if (JSON.stringify(preset) === JSON.stringify(this.preset)) return this.queue;
    if (displayTemplate(this.state.selected)) {
      const copy = copyPreset(preset, `${preset.name} custom`);
      return this.write({ version: 1, selected: copy.id, custom: [...this.state.custom, copy] });
    }
    return this.write({ ...this.collection(), custom: this.state.custom.map(item => item.id === preset.id ? preset : item) });
  }
  duplicate() { this.ready(); const copy = copyPreset(this.preset); return this.write({ version: 1, selected: copy.id, custom: [...this.state.custom, copy] }); }
  rename(name: string) { this.ready(); if (!this.state.custom.some(preset => preset.id === this.state.selected)) throw new Error('Rename a custom preset'); return this.update({ ...this.preset, name: name.trim() }); }
  remove(id: string) { this.ready(); return this.write({ version: 1, selected: this.state.selected === id ? 'classic' : this.state.selected, custom: this.state.custom.filter(preset => preset.id !== id) }); }
  retrySave() { this.ready(); return this.write(this.collection()); }
  async reset() { if (this.reading) await this.reading; return this.write(initial()); }
  settled() { return this.queue; }
}
