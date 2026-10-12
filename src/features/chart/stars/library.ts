import type { PresetStorage } from '../display/repository';
/** Only lookup identity is persisted. Metadata and reference positions belong to the catalog. */
export interface StarReference { id: string; name: string }
export const starId = (name: string) => `star:${name.trim().toLowerCase()}`;
export interface StarLibraryState { version: 1; stars: StarReference[]; loaded: boolean; loadError: boolean; saveError: boolean }
export function parseStarLibrary(raw: string | null): StarReference[] {
  if (raw === null) return [];
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.stars) || value.stars.length > 10000) throw new Error('Invalid star library');
  const ids = new Set<string>();
  return value.stars.map((star: StarReference) => {
    if (!star || typeof star.name !== 'string' || !star.name.trim() || star.name !== star.name.trim() || star.name.length > 200 || /[\x00-\x1f]/.test(star.name) || star.id !== starId(star.name) || ids.has(star.id)) throw new Error('Invalid star reference');
    ids.add(star.id);
    return { id: star.id, name: star.name };
  });
}
/** One owner per account with ordered writes, hydration gating and explicit recovery. */
export class StarLibraryRepository {
  state: StarLibraryState = { version: 1, stars: [], loaded: false, loadError: false, saveError: false };
  private listeners = new Set<() => void>();
  private queue = Promise.resolve();
  private reading?: Promise<void>;
  private generation = 0;
  readonly key: string;
  constructor(private storage: PresetStorage, scope: string | null) { this.key = `kairos.star-library.v1:${scope ?? 'anonymous'}`; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private emit() { this.listeners.forEach(listener => listener()); }
  load(): Promise<void> {
    if (this.state.loaded) return Promise.resolve();
    if (this.reading) return this.reading;
    this.reading = this.storage.getItem(this.key).then(raw => {
      this.state = { version: 1, stars: parseStarLibrary(raw), loaded: true, loadError: false, saveError: false }; this.emit();
    }).catch(() => { this.state = { ...this.state, loadError: true }; this.emit(); }).finally(() => { this.reading = undefined; });
    return this.reading;
  }
  private write(stars: StarReference[]) {
    const payload = JSON.stringify({ version: 1, stars });
    const validated = parseStarLibrary(payload);
    const generation = ++this.generation;
    this.state = { version: 1, stars: validated, loaded: true, loadError: false, saveError: false }; this.emit();
    this.queue = this.queue.then(() => this.storage.setItem(this.key, payload)).then(() => {
      if (generation === this.generation) { this.state = { ...this.state, saveError: false }; this.emit(); }
    }, () => {
      if (generation === this.generation) { this.state = { ...this.state, saveError: true }; this.emit(); }
    });
    return this.queue;
  }
  private ready() { if (!this.state.loaded || this.state.loadError) throw new Error('Restore your star library before editing'); }
  add(name: string) {
    this.ready(); const reference = { id: starId(name), name: name.trim() };
    return this.state.stars.some(star => star.id === reference.id) ? this.queue : this.write([...this.state.stars, reference]);
  }
  remove(id: string) { this.ready(); return this.write(this.state.stars.filter(star => star.id !== id)); }
  retrySave() { this.ready(); return this.write(this.state.stars); }
  async reset() { if (this.reading) await this.reading; return this.write([]); }
  settled() { return this.queue; }
}
