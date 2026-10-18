import { FieldSection, FieldRow, FieldToggle, FieldNavigation, FieldPicker, FieldStepper } from '@/components/fields';
import { Pressable, Text } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '@/theme';
export function Section({ title, children }: {
    title: string;
    children: ReactNode;
}) {
    return <FieldSection title={title}>{children}</FieldSection>;
}
export function Note({ children }: {
    children: ReactNode;
}) {
    const t = useTheme();
    return <Text style={[t.type.whyteXs, { color: t.color.txTertiary, marginVertical: 10 }]}>{children}</Text>;
}
export function Row({ label, detail, children, leading }: {
    label: string;
    detail?: string;
    children?: ReactNode;
    leading?: ReactNode;
}) {
    return <FieldRow label={label} detail={detail} leading={leading} control={children} />;
}
export function Toggle({ label, value, onChange, detail, leading, disabled = false }: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
    detail?: string;
    disabled?: boolean;
    leading?: ReactNode;
}) {
    return <FieldToggle label={label} detail={detail} leading={leading} value={value} onChange={onChange} disabled={disabled} />;
}
export function Action({ label, onPress }: {
    label: string;
    onPress: () => void;
}) {
    const t = useTheme();
    return <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }}>
    <Text style={[t.type.whyteSm, { color: t.color.txAccent }]}>{label}</Text>
  </Pressable>;
}
export function LinkRow({ label, detail, onPress }: {
    label: string;
    detail?: string;
    onPress: () => void;
}) {
    return <FieldNavigation label={label} detail={detail} onPress={onPress} />;
}
export function Choices<T extends string | number>({ label, value, options, onChange }: {
    label: string;
    value: T | undefined;
    options: readonly (readonly [
        T,
        string
    ])[];
    onChange: (v: T) => void;
}) {
    const selected = options.find(([option]) => option === value);
    const choices = options.map(([option, title], index) => ({ value: String(index), label: title }));
    return <FieldPicker label={label} value={selected ? String(options.indexOf(selected)) : '__unset'}
      options={selected ? choices : [{ value: '__unset', label: 'Choose…', disabled: true }, ...choices]}
      onChange={key => { const option = options[Number(key)]; if (option) onChange(option[0]); }} />;
}
export function NumberRow({ label, value, onChange, min = 0, max = 15, step = .5, suffix = '°' }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
}) {
    return <FieldStepper label={label} value={value} min={min} max={max} step={step}
      format={number => `${Math.round(number * 100) / 100}${suffix}`} onChange={onChange} />;
}
