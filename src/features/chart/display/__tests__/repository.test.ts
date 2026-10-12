import { PresetRepository, DISPLAY_PRESETS_KEY } from '../repository';
import { displayTemplate } from '../templates';
jest.mock('expo-crypto', () => { let n = 100; return { randomUUID: () => `00000000-0000-4000-8000-${String(++n).padStart(12,'0')}` }; });
function storage(raw: string | null = null) {
  return { getItem: jest.fn(async () => raw), setItem: jest.fn(async (_key: string, value: string) => { raw = value; }) };
}
test('editing forks a template once, autosaves, and restores the same custom preset', async () => {
  const disk = storage(), repo = new PresetRepository(disk);
  await repo.load();
  const template = repo.preset;
  await repo.update({ ...template, orientation: { mode:'ascendant',degree:90 } });
  const id = repo.preset.id;
  await repo.update({ ...repo.preset, orientation: { mode:'static',degree:180 } });
  expect(repo.state.custom).toHaveLength(1);
  expect(repo.preset.id).toBe(id);
  expect(displayTemplate('classic')!.orientation.degree).toBe(template.orientation.degree);
  const restored = new PresetRepository(disk); await restored.load();
  expect(restored.preset).toEqual(repo.preset);
  expect(disk.setItem).toHaveBeenCalledWith(DISPLAY_PRESETS_KEY, expect.any(String));
});
test('hydration is shared and edits cannot overwrite an unread document', async () => {
  let release!: (value: string | null) => void;
  const disk = storage(); disk.getItem.mockImplementation(() => new Promise(resolve => { release = resolve; }));
  const repo = new PresetRepository(disk), loading = repo.load();
  expect(repo.load()).toBe(loading);
  expect(() => repo.select('modern')).toThrow('Restore');
  expect(() => repo.update(displayTemplate('classic')!)).toThrow('Restore');
  expect(disk.setItem).not.toHaveBeenCalled();
  release(null); await loading; expect(repo.state.loaded).toBe(true);
});
test('corrupt storage remains untouched until an explicit reset', async () => {
  const disk = storage('{broken'), repo = new PresetRepository(disk); await repo.load();
  expect(repo.state.loadError).toBe(true); expect(repo.state.loaded).toBe(false);
  expect(() => repo.duplicate()).toThrow(); expect(disk.setItem).not.toHaveBeenCalled();
  await repo.reset(); expect(repo.state.loaded).toBe(true); expect(repo.state.selected).toBe('classic');
});
test('load errors can retry without creating a replacement document', async () => {
  const disk = storage(); disk.getItem.mockRejectedValueOnce(new Error('disk'));
  const repo = new PresetRepository(disk); await repo.load(); await repo.load();
  expect(repo.state.loaded).toBe(true); expect(disk.setItem).not.toHaveBeenCalled();
});
test('writes are ordered; a failed latest write keeps edits and can retry', async () => {
  const disk = storage(), repo = new PresetRepository(disk); await repo.load();
  let finish!: () => void;
  disk.setItem.mockImplementationOnce(() => new Promise(resolve=>{finish=resolve;}));
  const first = repo.select('minimal'); const second = repo.select('modern');
  await Promise.resolve(); expect(disk.setItem).toHaveBeenCalledTimes(1); finish();
  await first; await second;
  expect(JSON.parse(disk.setItem.mock.calls[1][1]).selected).toBe('modern');
  disk.setItem.mockRejectedValueOnce(new Error('full')); await repo.select('study');
  expect(repo.state.saveError).toBe(true); expect(repo.state.selected).toBe('study');
  await repo.retrySave(); expect(repo.state.saveError).toBe(false);
});
test('duplicate, rename, selection and delete preserve independent copies', async () => {
  const repo = new PresetRepository(storage()); await repo.load(); await repo.duplicate();
  const first = repo.preset.id; await repo.rename('My wheel'); await repo.duplicate();
  const second = repo.preset.id; expect(second).not.toBe(first);
  await repo.select(first); expect(repo.preset.name).toBe('My wheel'); await repo.remove(first);
  expect(repo.state.selected).toBe('classic'); expect(repo.state.custom.map(p=>p.id)).toEqual([second]);
});
