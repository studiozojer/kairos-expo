export const DIRECTIONS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as const;
export type MarkingDirection = typeof DIRECTIONS[number];
export interface MarkingOption { id: string; position: MarkingDirection; label: string; disabled?: boolean; onSelect: () => void }
export interface MenuSession {
  token: number; owner: string; center: { x: number; y: number }; options: readonly MarkingOption[];
  shown: boolean; highlighted?: string; marked: boolean; started: number; onTap?: () => void;
}
export function markingDirection(x: number, y: number): MarkingDirection | undefined {
  if (Math.hypot(x, y) < 20) return undefined;
  const angle = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return DIRECTIONS[Math.floor((angle + 22.5) / 45) % 8];
}
/** One live owner. Every timer/update/release must still own its original token. */
export class MarkingMenuController {
  current: MenuSession | null = null;
  private serial = 0;
  private enabled = true;
  setEnabled(enabled: boolean) { this.enabled = enabled; if (!enabled) this.cancel(); }
  private timer?: ReturnType<typeof setTimeout>;
  constructor(private notify: (session: MenuSession | null) => void) {}
  begin(owner: string, center: MenuSession['center'], options: readonly MarkingOption[], onTap?: () => void) {
    if (!this.enabled || this.current) return undefined;
    const token = ++this.serial;
    this.current = { token, owner, center, options, onTap, shown: false, marked: false, started: Date.now() };
    this.notify(this.current);
    this.timer = setTimeout(() => {
      if (this.current?.token !== token) return;
      this.current = { ...this.current, shown: true }; this.notify(this.current);
    }, 100);
    return token;
  }
  update(token: number | undefined, x: number, y: number) {
    if (!this.current || this.current.token !== token) return;
    const direction = markingDirection(x, y);
    const highlighted = this.current.options.find(option => option.position === direction && !option.disabled)?.id;
    if (this.current.highlighted === highlighted && (!direction || this.current.marked)) return;
    this.current = { ...this.current, highlighted, marked: this.current.marked || !!direction, shown: this.current.shown || !!direction };
    this.notify(this.current);
  }
  end(token: number | undefined, x: number, y: number) {
    if (!this.current || this.current.token !== token) return;
    this.update(token, x, y);
    const session = this.current;
    const tap = !session.marked && Date.now() - session.started < 200 && Math.hypot(x, y) < 10;
    const action = tap ? session.onTap : session.options.find(o => o.id === session.highlighted && !o.disabled)?.onSelect;
    this.cancel(token);
    action?.();
  }
  cancel(token?: number) {
    if (token !== undefined && this.current?.token !== token) return;
    clearTimeout(this.timer); this.current = null; this.notify(null);
  }
  cancelOwner(owner: string) { if (this.current?.owner === owner) this.cancel(); }
  dispose() { clearTimeout(this.timer); this.current = null; }
}
