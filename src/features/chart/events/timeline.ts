import { fetchEventWindow } from './api';
import type { EventCapabilities, EventQuery, EventSearchResult, SkyEvent } from './types';
import type { TimelineNode, TimelineSlots } from './timelineTypes';

const DAY = 86_400_000;
const MAX_CACHED_WINDOWS = 48;
const stamp = (event: SkyEvent) => Date.parse(event.time);
function abortIfNeeded(signal: AbortSignal) {
  if (signal.aborted) { const error = new Error('Event timeline cancelled'); error.name = 'AbortError'; throw error; }
}

export function eventNode(event: SkyEvent): TimelineNode {
  const detail = event.kind === 'aspect'
    ? [event.aspect, event.target.type, event.target.type === 'moving' ? event.target.body : event.target.id,
      event.target.type === 'fixed' ? event.target.longitude : null]
    : event.kind === 'ingress' ? [event.from_sign, event.to_sign] : [event.direction];
  const time = stamp(event);
  return { id: JSON.stringify([time, event.kind, event.body, ...detail]), kind: 'event', time, event };
}

function compareNodes(a: TimelineNode, b: TimelineNode) {
  const priority = { event: 0, origin: 1, entry: 2 };
  return a.time - b.time || priority[a.kind] - priority[b.kind] || a.id.localeCompare(b.id);
}

/** Stable ties make simultaneous events one stop, with real events preferred over markers. */
export function timelineSlots(nodes: TimelineNode[], time: number): TimelineSlots {
  const sorted = nodes.filter(node => Number.isFinite(node.time)).slice().sort(compareNodes);
  const unique = sorted.filter((node, index) => index === 0 || node.time !== sorted[index - 1].time);
  const centered = unique.filter(node => Math.abs(node.time - time) <= 1)
    .sort((a, b) => Math.abs(a.time - time) - Math.abs(b.time - time) || compareNodes(a, b))[0] ?? null;
  const previous = unique.filter(node => node.time < time - 1).slice(-2);
  const next = unique.filter(node => node.time > time + 1).slice(0, 2);
  return [previous.length === 2 ? previous[0] : null, previous.at(-1) ?? null, centered, next[0] ?? null, next[1] ?? null];
}

type CachedWindow = { from: number; to: number; events: SkyEvent[] };

/** Only complete coverage is cached. Every lookup walks coverage before considering distant events. */
export class EventTimelineCache {
  private readonly query: EventQuery;
  private readonly capabilities: EventCapabilities;
  private readonly windows = new Map<number, CachedWindow>();
  private latestAnchor = 0;

  constructor(query: EventQuery, capabilities: EventCapabilities) {
    // Freeze the meaning of cached fixed positions and advertised bounds for this session.
    this.query = { ...query, bodies: [...query.bodies], kinds: [...query.kinds], aspects: [...query.aspects], fixed_points: query.fixed_points?.map(point => ({ ...point })) };
    this.capabilities = { ...capabilities, bodies: [...capabilities.bodies], kinds: [...capabilities.kinds], aspects: [...capabilities.aspects], modes: [...capabilities.modes] };
  }

  get events(): SkyEvent[] {
    const nodes = [...this.windows.values()].flatMap(window => window.events).map(eventNode).sort(compareNodes);
    const unique = new Map<string, SkyEvent>();
    for (const node of nodes) if (node.kind === 'event') unique.set(node.id, node.event);
    return [...unique.values()];
  }

  /** Visible neighbors must share uninterrupted coverage with the current chart time. */
  eventsAround(time: number): SkyEvent[] {
    const windows = [...this.windows.values()].sort((a, b) => a.from - b.from);
    let component: CachedWindow[] = [];
    let end = -Infinity;
    const events = () => component.flatMap(window => window.events).map(eventNode).sort(compareNodes)
      .filter((node, index, nodes) => index === 0 || node.id !== nodes[index - 1].id)
      .flatMap(node => node.kind === 'event' ? [node.event] : []);
    for (const window of windows) {
      if (window.from > end) {
        if (component.length && component[0].from <= time && time <= end) return events();
        component = [];
      }
      component.push(window);
      end = window.to;
    }
    return component.length && component[0].from <= time && time <= end ? events() : [];
  }

  private prune() {
    const distance = (window: CachedWindow) => Math.max(window.from - this.latestAnchor, this.latestAnchor - window.to, 0);
    const ordered = [...this.windows.entries()].sort((a, b) => distance(a[1]) - distance(b[1]) || a[0] - b[0]);
    for (const [key] of ordered.slice(MAX_CACHED_WINDOWS)) this.windows.delete(key);
  }

  async search(anchor: number, direction: -1 | 1, signal: AbortSignal, skipCurrent = false, maxWindows = 12): Promise<EventSearchResult> {
    const cap = this.capabilities, query = this.query;
    const lower = Date.parse(cap.supported_from), upper = Date.parse(cap.supported_to);
    const width = Math.floor(cap.max_window_days * DAY);
    if (!cap.available || !Number.isFinite(anchor) || !(lower <= anchor && anchor <= upper)
      || !(width > 0 && width <= 31 * DAY) || !Number.isInteger(maxWindows) || maxWindows < 0 || maxWindows > 12
      || cap.zodiac !== query.zodiac || !query.bodies.every(body => cap.bodies.includes(body))
      || !query.kinds.every(kind => cap.kinds.includes(kind)) || !query.aspects.every(aspect => cap.aspects.includes(aspect))
      || !cap.modes.includes(query.fixed_points?.length ? 'moving_fixed' : 'moving_moving')) throw new Error('This selection is not supported by the event service.');
    this.latestAnchor = anchor;
    let boundary = anchor, requests = 0;
    while (true) {
      abortIfNeeded(signal);
      if (direction === 1 ? boundary >= upper : boundary <= lower) return { event: null, boundary, exhausted: true };
      // A backward search ending exactly on a grid edge must visit the tile to its left.
      const index = direction === 1 ? Math.floor(boundary / width) : Math.ceil(boundary / width) - 1;
      const from = Math.max(lower, index * width), to = Math.min(upper, (index + 1) * width);
      let window = this.windows.get(index);
      if (!window) {
        if (requests >= maxWindows) return { event: null, boundary, exhausted: false };
        requests++;
        const result = await fetchEventWindow(query, from, to, signal);
        abortIfNeeded(signal);
        if (result.events.length > cap.max_events) throw new Error('The event service exceeded its advertised event limit.');
        window = { from, to, events: result.events };
        this.windows.set(index, window);
        this.prune();
      }
      const eligible = window.events.filter(event => {
        const time = stamp(event);
        return (direction === 1 ? time >= boundary : time < boundary)
          && (skipCurrent ? direction * (time - anchor) > 1_000 : direction * (time - anchor) >= 0);
      }).map(eventNode).sort(compareNodes);
      // Collapse a simultaneous stop identically in both navigation directions.
      const nearestTime = direction === 1 ? eligible[0]?.time : eligible.at(-1)?.time;
      const nearest = eligible.find(node => node.time === nearestTime);
      if (nearest?.kind === 'event') return { event: nearest.event, boundary: nearest.time, exhausted: false };
      boundary = direction === 1 ? to : from;
    }
  }
}
