import { fieldFocusVisible } from './focus';
import { PickerControl } from './PickerControl';
import type { FieldOption } from './PickerControl.types';
export type { FieldOption } from './PickerControl.types';
import { Children, Fragment, isValidElement, useState, type ReactNode } from 'react';
import { Platform, Pressable, Switch, Text, TextInput, View, useWindowDimensions, type TextInputProps } from 'react-native';
import { useFieldTheme } from './theme';
export { FieldProvider, type FieldTheme } from './theme';

/** Direct children are rows; a composite child owns its internal separators. */
export function FieldSection({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  const t = useFieldTheme();
  const rows = Children.toArray(children).filter(child => typeof child !== 'boolean');
  return <View style={{ gap: t.space.sm, marginBottom: t.space.xxl }}>
    {title && <Text accessibilityRole="header" style={[t.type.whyteSm, { color: t.color.txSecondary, paddingHorizontal: t.space.lg }]}>{title}</Text>}
    <View style={{ borderRadius: t.radius.xl, backgroundColor: t.color.bgSolidCard, overflow: 'hidden' }}>
      {rows.map((row, index) => <Fragment key={isValidElement(row) ? row.key ?? index : index}>
        {index > 0 && <View accessible={false} style={{ height: t.border.hairline, marginHorizontal: t.space.lg, backgroundColor: t.color.bdPrimary }} />}
        {row}
      </Fragment>)}
    </View>
    {footer && <Text style={[t.type.whyteXs, { color: t.color.txSecondary, paddingHorizontal: t.space.lg }]}>{footer}</Text>}
  </View>;
}
export type FieldRowProps = {
  label: string; detail?: string; value?: string; leading?: ReactNode;
  control?: ReactNode; disabled?: boolean; destructive?: boolean; controlLayout?: 'inline' | 'below';
};
/** Noninteractive layout primitive. The control, or a wrapper, owns interaction. */
export function FieldRow({ label, detail, value, leading, control, disabled = false, destructive = false, controlLayout = 'inline' }: FieldRowProps) {
  const t = useFieldTheme();
  const { fontScale } = useWindowDimensions();
  const stackValue = value !== undefined && (t.type.whyteSm.fontSize ?? 16) * fontScale > 20;
  const stackControl = controlLayout === 'below' || (!!control && (t.type.whyteSm.fontSize ?? 16) * fontScale > 20 && value === undefined);
  const foreground = disabled ? t.color.txDisabled : destructive ? t.color.txError : t.color.txPrimary;
  return <View style={{ minHeight: 52, paddingHorizontal: t.space.lg, paddingVertical: t.space.md, flexDirection: 'row', alignItems: 'center', gap: t.space.md }}>
    {leading && <View style={{ width: 24, alignItems: 'center' }}>{leading}</View>}
    <View style={{ flex: 1, minWidth: 0, gap: t.space.xs }}>
      <Text style={[t.type.whyteSm, { color: foreground }]}>{label}</Text>
      {detail && <Text style={[t.type.whyteXs, { color: disabled ? t.color.txDisabled : t.color.txSecondary }]}>{detail}</Text>}
      {stackControl && control}
      {stackValue && <Text style={[t.type.whyteSm, { color: disabled ? t.color.txDisabled : t.color.txSecondary }]}>{value}</Text>}
    </View>
    {((value !== undefined && !stackValue) || (control && !stackControl)) && <View style={{ flexShrink: 1, maxWidth: '48%', flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: t.space.sm }}>
      {value !== undefined && !stackValue && <Text style={[t.type.whyteSm, { color: disabled ? t.color.txDisabled : t.color.txSecondary, flexShrink: 1, textAlign: 'right' }]}>{value}</Text>}
      {!stackControl && control}
    </View>}
  </View>;
}
export function FieldToggle({ value, onChange, ...row }: Omit<FieldRowProps, 'value' | 'control' | 'destructive'> & { value: boolean; onChange: (value: boolean) => void }) {
  const t = useFieldTheme();
  return <FieldRow {...row} control={<Switch accessibilityLabel={row.label} accessibilityHint={row.detail} disabled={row.disabled} value={value} onValueChange={onChange} trackColor={{ true: t.color.txAccent }} />} />;
}
function Indicator({ down = false }: { down?: boolean }) {
  const t = useFieldTheme();
  return <View accessible={false} style={{ width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 6, height: 6, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: t.color.icTertiary, transform: [{ rotate: down ? '135deg' : '45deg' }] }} /></View>;
}
type ActionRow = Omit<FieldRowProps, 'control'> & { onPress: () => void; accessibilityLabel?: string };
function FieldAction({ onPress, accessibilityLabel, picker, ...row }: ActionRow & { picker: boolean }) {
  const t = useFieldTheme();
  const [focused, setFocused] = useState(false);
  return <Pressable onFocus={event => setFocused(fieldFocusVisible(event))} onBlur={() => setFocused(false)} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? row.label} accessibilityHint={[row.value, row.detail].filter(Boolean).join('. ') || undefined} accessibilityState={{ disabled: !!row.disabled }} disabled={row.disabled} onPress={event => { setFocused(fieldFocusVisible(event)); onPress(); }}
    style={({ pressed }) => ({ backgroundColor: pressed || focused ? t.color.bgSolidCardPressed : 'transparent', ...(Platform.OS === 'web' ? { outlineStyle: 'solid' as const, outlineWidth: 0 } : {}) })}>
    <FieldRow {...row} control={<Indicator down={picker} />} />
  </Pressable>;
}
export function FieldNavigation(props: ActionRow) { return <FieldAction {...props} picker={false} />; }
export type FieldPickerProps = Omit<FieldRowProps, 'value' | 'control' | 'destructive'> & {
  value: string; options: readonly FieldOption[]; onChange: (value: string) => void;
};
export function FieldPicker({ value, options, onChange, ...row }: FieldPickerProps) {
  return <PickerControl label={row.label} value={value} options={options} onChange={onChange} disabled={row.disabled}>
    <FieldRow {...row} value={options.find(option => option.value === value)?.label ?? value} control={<Indicator down />} />
  </PickerControl>;
}

export type FieldStepperProps = Omit<FieldRowProps, 'value' | 'control' | 'destructive'> & {
  value: number; onChange: (value: number) => void; min: number; max: number;
  step?: number; format?: (value: number) => string;
};
/** Decimal rounding avoids 0.1 + 0.2 artifacts; every action clamps to range. */
export function steppedValue(value: number, direction: -1 | 1, min: number, max: number, step: number) {
  if (![value, min, max, step].every(Number.isFinite) || min > max || step <= 0) throw new Error('Invalid FieldStepper range/value');
  return Math.max(min, Math.min(max, Number((value + direction * step).toFixed(10))));
}
export function FieldStepper({ value, onChange, min, max, step = 1, format = String, ...row }: FieldStepperProps) {
  const t = useFieldTheme();
  const [focused, setFocused] = useState<-1 | 1 | null>(null);
  const change = (direction: -1 | 1) => { const next = steppedValue(value, direction, min, max, step); if (!row.disabled && next !== value) onChange(next); };
  const button = (direction: -1 | 1) => {
    const disabled = row.disabled || (direction < 0 ? value <= min : value >= max);
    return <Pressable onFocus={event => setFocused(fieldFocusVisible(event) ? direction : null)} onBlur={() => setFocused(null)} accessibilityRole="button" accessibilityLabel={`${direction < 0 ? 'Decrease' : 'Increase'} ${row.label}`} accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={event => { setFocused(fieldFocusVisible(event) ? direction : null); change(direction); }}
      style={({ pressed }) => ({ minWidth: 44, minHeight: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed || focused === direction ? t.color.bgSolidCardPressed : 'transparent', ...(Platform.OS === 'web' ? { outlineStyle: 'solid' as const, outlineWidth: 0 } : {}) })}>
      <View accessible={false} style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 14, height: 1.5, borderRadius: 1, backgroundColor: disabled ? t.color.icDisabled : t.color.icPrimary }} />
        {direction > 0 && <View style={{ position: 'absolute', width: 1.5, height: 14, borderRadius: 1, backgroundColor: disabled ? t.color.icDisabled : t.color.icPrimary }} />}
      </View>
    </Pressable>;
  };
  return <FieldRow {...row} control={<View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs, flexWrap: 'wrap' }}>
    <Text accessibilityLiveRegion="polite" style={[t.type.whyteSm, { color: row.disabled ? t.color.txDisabled : t.color.txSecondary, minWidth: 36, textAlign: 'right', marginRight: t.space.sm }]}>{format(value)}</Text>
    <View style={{ flexDirection: 'row', backgroundColor: t.color.bgSecondary, borderRadius: t.radius.md, overflow: 'hidden' }}>
      {button(-1)}<View style={{ width: t.border.hairline, marginVertical: t.space.sm, backgroundColor: t.color.bdPrimary }} />{button(1)}
    </View>
  </View>} />;
}

export function FieldText({ label, detail, error, disabled, ...input }: Omit<TextInputProps, 'editable'> & { label: string; detail?: string; error?: string; disabled?: boolean }) {
  const t = useFieldTheme();
  const [focused, setFocused] = useState(false);
  return <View style={{ padding: t.space.lg, gap: t.space.sm }}>
    <Text style={[t.type.whyteSm, { color: disabled ? t.color.txDisabled : t.color.txPrimary }]}>{label}</Text>
    {detail && <Text style={[t.type.whyteXs, { color: t.color.txSecondary }]}>{detail}</Text>}
    <TextInput {...input} onFocus={event => { setFocused(true); input.onFocus?.(event); }} onBlur={event => { setFocused(false); input.onBlur?.(event); }} accessibilityLabel={label} accessibilityHint={error ?? detail} editable={!disabled} placeholderTextColor={t.color.txSecondary}
      style={[t.type.whyteSm, { minHeight: 44, padding: t.space.sm, borderWidth: t.border.hairline, borderColor: error ? t.color.txError : t.color.bdPrimary, backgroundColor: focused ? t.color.bgSolidCardPressed : 'transparent', ...(Platform.OS === 'web' ? { outlineStyle: 'solid' as const, outlineWidth: 0 } : {}), borderRadius: t.radius.md, color: disabled ? t.color.txDisabled : t.color.txPrimary }, input.style]} />
    {error && <Text accessibilityRole="alert" style={[t.type.whyteXs, { color: t.color.txError }]}>{error}</Text>}
  </View>;
}
export type FieldColorOption = FieldOption & { color?: string };
/** Semantic IDs remain the value; resolved colors are presentation only. */
export function FieldColor({ value, options, onChange, ...row }: Omit<FieldPickerProps, 'value' | 'options'> & { value: string; options: readonly FieldColorOption[] }) {
  const t = useFieldTheme();
  const selected = options.find(option => option.value === value);
  return <PickerControl label={row.label} value={value} options={options} onChange={onChange} disabled={row.disabled}>
    <FieldRow {...row} value={selected?.label ?? value} control={<>
      <View accessible={false} style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: t.color.bdPrimary, backgroundColor: selected?.color ?? 'transparent' }} />
      <Indicator down />
    </>} />
  </PickerControl>;
}
