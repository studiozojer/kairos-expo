import { DEFAULT_SETTINGS, HOUSE_SYSTEMS, isLocation, type ChartSettings } from '../settings/chartSettings';
import { MAX_TIME, MIN_TIME, stepTime, TIME_STEPS } from '../time/timeSteps';

export interface SavedChart { id: string; name: string; datetime: string; settings: ChartSettings }
export type ChartDraft = Omit<SavedChart, 'id'>;
export interface ActiveChart {
  id: string; sourceId?: string; kind: 'saved' | 'now'; name: string;
  origin: number; time: number; settings: ChartSettings; unit: number;
}
export interface ActiveSession { version: 1; saved: SavedChart[]; active: ActiveChart[]; targetId: string | null }
export const ACTIVE_CHARTS_KEY = 'kairos.active-charts.v1';
let sequence = 0;
export const newChartId = () => `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2)}`;
export const snapshotSettings = (settings: ChartSettings): ChartSettings => ({ ...settings, location: { ...settings.location } });
const validTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= MIN_TIME && value <= MAX_TIME;
const validSettings = (value: unknown): value is ChartSettings => !!value && typeof value === 'object' && isLocation((value as ChartSettings).location) && HOUSE_SYSTEMS.includes((value as ChartSettings).houseSystem);
export function validateDraft(value: ChartDraft) {
  if (!value || typeof value.name !== 'string' || !value.name.trim() || typeof value.datetime !== 'string' || !/Z$/.test(value.datetime) || !validTime(Date.parse(value.datetime)) || !validSettings(value.settings)) throw new Error('Invalid chart name, date, location, or settings');
}
export function nowInstance(settings = DEFAULT_SETTINGS, now = Date.now()): ActiveChart {
  const time = Math.max(MIN_TIME, Math.min(MAX_TIME, now));
  return { id: newChartId(), kind: 'now', name: 'Now', origin: time, time, settings: snapshotSettings(settings), unit: 2 };
}
export function initialSession(settings = DEFAULT_SETTINGS): ActiveSession {
  const chart = nowInstance(settings);
  return { version: 1, saved: [], active: [chart], targetId: chart.id };
}
export function parseSession(raw: string): ActiveSession {
  const value = JSON.parse(raw) as ActiveSession;
  if (!value || value.version !== 1 || !Array.isArray(value.saved) || !Array.isArray(value.active) || value.active.length > 3) throw new Error('Invalid active chart storage');
  const ids = new Set<string>();
  for (const saved of value.saved) {
    validateDraft(saved);
    if (typeof saved.id !== 'string' || !saved.id || ids.has(saved.id)) throw new Error('Invalid saved chart identity');
    ids.add(saved.id);
  }
  ids.clear();
  for (const chart of value.active) {
    if (!chart || typeof chart.id !== 'string' || !chart.id || ids.has(chart.id) || !['now', 'saved'].includes(chart.kind) || typeof chart.name !== 'string' || !chart.name.trim() || !validTime(chart.time) || !validTime(chart.origin) || !validSettings(chart.settings) || !Number.isInteger(chart.unit) || chart.unit < 0 || chart.unit >= TIME_STEPS.length || (chart.kind === 'saved' && (typeof chart.sourceId !== 'string' || !value.saved.some(saved => saved.id === chart.sourceId)))) throw new Error('Invalid open chart');
    ids.add(chart.id);
  }
  if (value.active.length ? !ids.has(value.targetId as string) : value.targetId !== null) throw new Error('Invalid stepper target');
  return value;
}
export function openInstance(state: ActiveSession, chart: ActiveChart, replaceId?: string): ActiveSession | null {
  if (replaceId !== undefined) {
    const index = state.active.findIndex(item => item.id === replaceId);
    if (index < 0) return null;
    return { ...state, active: state.active.map((item, i) => i === index ? chart : item), targetId: chart.id };
  }
  if (state.active.length >= 3) return null;
  return { ...state, active: [...state.active, chart], targetId: chart.id };
}
export function removeInstance(state: ActiveSession, id: string): ActiveSession {
  const index = state.active.findIndex(chart => chart.id === id);
  if (index < 0) return state;
  const active = state.active.filter(chart => chart.id !== id);
  return { ...state, active, targetId: state.targetId === id ? (active[Math.min(index, active.length - 1)]?.id ?? null) : state.targetId };
}
export function moveInstance(state: ActiveSession, id: string, direction: -1 | 1): ActiveSession {
  const index = state.active.findIndex(chart => chart.id === id), next = index + direction;
  if (index < 0 || next < 0 || next >= state.active.length) return state;
  const active = [...state.active];
  [active[index], active[next]] = [active[next], active[index]];
  return { ...state, active };
}
export function changeTarget(state: ActiveSession, change: (chart: ActiveChart) => ActiveChart): ActiveSession {
  return { ...state, active: state.active.map(chart => chart.id === state.targetId ? change(chart) : chart) };
}
export const stepTarget = (state: ActiveSession, direction: -1 | 1) => changeTarget(state, chart => ({ ...chart, time: stepTime(chart.time, chart.unit, direction) }));
export const resetTarget = (state: ActiveSession, now = Date.now()) => changeTarget(state, chart => {
  const time = chart.kind === 'now' ? Math.max(MIN_TIME, Math.min(MAX_TIME, now)) : chart.origin;
  return { ...chart, time, origin: chart.kind === 'now' ? time : chart.origin };
});
