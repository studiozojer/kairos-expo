import { EVENT_ASPECTS, EVENT_BODIES, type EventCapabilities, type EventQuery, type EventSearchResult, type EventWindow, type SkyEvent } from './types';

const DAY = 86_400_000;
const baseURL = (process.env.EXPO_PUBLIC_KAIROS_API_URL ?? 'https://api.kairos.solar').replace(/\/$/, '');
export class EventServiceError extends Error {
  constructor(
    public readonly kind: 'network' | 'timeout' | 'http' | 'invalid_response',
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) { super(message); this.name = 'EventServiceError'; }
}
const invalid = () => new EventServiceError('invalid_response', 'The event service returned an incompatible or incomplete response.');
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const date = (v: unknown) => typeof v === 'string' ? Date.parse(v) : NaN;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
function aborted() { const error = new Error('Event request cancelled'); error.name = 'AbortError'; return error; }

/** Includes response decoding in the deadline, even if a fetch implementation ignores abort. */
async function request(path: string, signal: AbortSignal, timeout: number, body?: unknown): Promise<unknown> {
  if (signal.aborted) throw aborted();
  const controller = new AbortController();
  let cancel!: (error: Error) => void;
  let httpFailure: EventServiceError | undefined;
  const interrupted = new Promise<never>((_, reject) => { cancel = reject; });
  const onAbort = () => { controller.abort(); cancel(aborted()); };
  signal.addEventListener('abort', onAbort);
  const timer = setTimeout(() => { controller.abort(); cancel(httpFailure ?? new EventServiceError('timeout', 'The event service took too long to respond.')); }, timeout);
  try {
    return await Promise.race([interrupted, (async () => {
      let response: Response;
      try { response = await fetch(`${baseURL}${path}`, {
        method: body === undefined ? 'GET' : 'POST', signal: controller.signal,
        headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }); } catch (error) {
        if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw aborted();
        throw new EventServiceError('network', 'Could not connect to the event service.');
      }
      if (!response.ok) {
        httpFailure = new EventServiceError('http', `The event service could not complete this request (${response.status}).`, response.status);
        let code: string | undefined;
        try {
          const value: unknown = await response.json();
          if (object(value) && typeof value.error === 'string'
            && ['busy', 'computation_unavailable', 'unavailable', 'unsupported_query'].includes(value.error)) code = value.error;
        } catch { /* HTTP status is still useful when an error body is not JSON. */ }
        throw new EventServiceError('http', `The event service could not complete this request (${response.status}).`, response.status, code);
      }
      try { return await response.json() as unknown; }
      catch (error) {
        if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw aborted();
        if (error instanceof TypeError) throw new EventServiceError('network', 'Could not read the event service response.');
        throw invalid();
      }
    })()]);
  } finally { clearTimeout(timer); signal.removeEventListener('abort', onAbort); }
}

export async function fetchEventCapabilities(signal: AbortSignal): Promise<EventCapabilities> {
  const value = await request('/api/sky/status?minor_aspects=true', signal, 8_000);
  if (!object(value) || value.schema_version !== 1 || typeof value.available !== 'boolean') throw invalid();
  // Disabled deployments may intentionally omit all capability details.
  if (!value.available) return { schema_version: 1, available: false, supported_from: '', supported_to: '', max_window_days: 0, max_events: 0, bodies: [], aspects: [], kinds: [], modes: [], zodiac: '', reason: typeof value.reason === 'string' ? value.reason : 'unavailable' };
  if (value.zodiac !== 'tropical' || !(date(value.supported_from) < date(value.supported_to))
    || typeof value.max_window_days !== 'number' || value.max_window_days <= 0 || value.max_window_days > 31
    || !Number.isInteger(value.max_events) || Number(value.max_events) <= 0
    || !strings(value.bodies) || !value.bodies.length || !value.bodies.every(x => EVENT_BODIES.includes(x as never))
    || !strings(value.aspects) || !value.aspects.every(x => EVENT_ASPECTS.includes(x as never))
    || !strings(value.kinds) || !value.kinds.every(x => ['aspect', 'ingress', 'station'].includes(x))
    || !strings(value.modes) || typeof value.reason !== 'string') throw invalid();
  return value as unknown as EventCapabilities;
}

function matches(event: unknown, query: EventQuery, from: number, to: number): event is SkyEvent {
  if (!object(event) || !query.bodies.includes(event.body as never) || !query.kinds.includes(event.kind as never)
    || !(date(event.time) >= from && date(event.time) < to)) return false;
  if (event.kind === 'station') return event.direction === 'direct' || event.direction === 'retrograde';
  if (event.kind === 'ingress') return [event.from_sign, event.to_sign].every(x => Number.isInteger(x) && Number(x) >= 0 && Number(x) < 12)
    && event.from_sign !== event.to_sign;
  if (event.kind !== 'aspect' || !query.aspects.includes(event.aspect as never)
    || typeof event.residual_degrees !== 'number' || !Number.isFinite(event.residual_degrees) || !object(event.target)) return false;
  const target = event.target;
  if (query.fixed_points?.length) return target.type === 'fixed' && query.fixed_points.some(point => point.id === target.id && point.longitude === target.longitude);
  return event.target.type === 'moving' && query.bodies.includes(event.target.body as never) && event.target.body !== event.body;
}

export async function fetchEventWindow(query: EventQuery, from: number, to: number, signal: AbortSignal): Promise<EventWindow> {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 31 * DAY) throw new Error('Invalid event window.');
  const value = await request('/api/sky/events', signal, 45_000, { ...query, from: new Date(from).toISOString(), to: new Date(to).toISOString() });
  if (!object(value) || value.schema_version !== 1 || value.coverage_complete !== true || date(value.from) !== from || date(value.to) !== to
    || !Array.isArray(value.events) || !value.events.every(event => matches(event, query, from, to))) throw invalid();
  for (let i = 1; i < value.events.length; i++) if (date(value.events[i].time) < date(value.events[i - 1].time)) throw invalid();
  return value as unknown as EventWindow;
}

/** Bounded sequential search. Empty is complete coverage, never a transport failure. */
export async function findEvent(query: EventQuery, anchor: number, direction: -1 | 1, capabilities: EventCapabilities, signal: AbortSignal, skipCurrent = true): Promise<EventSearchResult> {
  const lower = date(capabilities.supported_from), upper = date(capabilities.supported_to);
  if (!capabilities.available || !Number.isFinite(anchor) || !(lower <= anchor && anchor <= upper)
    || capabilities.zodiac !== query.zodiac || !query.bodies.every(x => capabilities.bodies.includes(x))
    || !query.kinds.every(x => capabilities.kinds.includes(x)) || !query.aspects.every(x => capabilities.aspects.includes(x))
    || !capabilities.modes.includes(query.fixed_points?.length ? 'moving_fixed' : 'moving_moving')
    || !(capabilities.max_window_days > 0 && capabilities.max_window_days <= 31)) throw new Error('This selection is not supported by the event service.');
  let boundary = anchor;
  for (let count = 0; count < 12; count++) {
    if (signal.aborted) throw aborted();
    const next = Math.max(lower, Math.min(upper, boundary + direction * capabilities.max_window_days * DAY));
    if (next === boundary) return { event: null, boundary, exhausted: true };
    const window = await fetchEventWindow(query, Math.min(boundary, next), Math.max(boundary, next), signal);
    if (window.events.length > capabilities.max_events) throw invalid();
    const eligible = window.events.filter(event => (skipCurrent ? direction * (date(event.time) - anchor) > 1_000 : direction * (date(event.time) - anchor) >= 0));
    const event = direction === 1 ? eligible[0] : eligible[eligible.length - 1];
    if (event) return { event, boundary: date(event.time), exhausted: false };
    boundary = next;
  }
  return { event: null, boundary, exhausted: boundary === lower || boundary === upper };
}
