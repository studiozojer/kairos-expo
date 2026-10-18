import { useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useFieldTheme } from './theme';
import type { PickerControlProps } from './PickerControl.types';

/** Browser select supplies option/keyboard behavior, anchored to the value. */
export function PickerControl({ label, value, options, onChange, disabled, children }: PickerControlProps) {
  const t = useFieldTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = (t.type.whyteSm.fontSize ?? 16) * fontScale > 20;
  const select = useRef<HTMLSelectElement>(null);
  const [focused, setFocused] = useState(false);
  return <div onPointerDown={() => setFocused(false)} onClick={event => {
    // Keep the row clickable without stretching the popup's anchor to its width.
    if (disabled || event.target === select.current) return;
    select.current?.focus();
    // Older/embedded browsers can still use the compact select directly.
    try { select.current?.showPicker?.(); } catch { /* Focus remains on the native select. */ }
  }} style={{ position: 'relative', cursor: disabled ? 'default' : 'pointer', backgroundColor: focused ? t.color.bgSolidCardPressed : 'transparent' }}>
    {children}
    <select ref={select} aria-label={label} value={value} disabled={disabled} onFocus={event => setFocused(event.currentTarget.matches(':focus-visible'))} onBlur={() => setFocused(false)} onChange={event => onChange(event.target.value)}
      style={{ position: 'absolute', ...(stacked ? { left: t.space.lg, bottom: t.space.md, maxWidth: `calc(100% - ${2 * t.space.lg}px)` } : { right: t.space.lg, top: '50%', transform: 'translateY(-50%)', maxWidth: '48%' }), width: 'auto', height: 44, opacity: 0, cursor: disabled ? 'default' : 'pointer', fontFamily: String(t.type.whyteSm.fontFamily), fontSize: Number(t.type.whyteSm.fontSize) }}>
      {options.map(option => <option key={option.value} value={option.value} disabled={option.disabled} style={{ color: t.color.txPrimary, backgroundColor: t.color.bgSolidCard }}>{option.label}</option>)}
    </select>
  </div>;
}
