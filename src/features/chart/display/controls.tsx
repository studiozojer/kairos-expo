import { Pressable, Switch, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '@/theme';
export function Section({ title, children }: {
    title: string;
    children: ReactNode;
}) {
    const t = useTheme();
    return <View style={{ marginBottom: 24 }}>
    <Text style={[t.type.fraktionXxs, { color: t.color.txTertiary, marginBottom: 10, textTransform: 'uppercase' }]}>{title}</Text>
    {children}
  </View>;
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
    const t = useTheme();
    return <View style={{ minHeight: 54, paddingVertical: 9, flexDirection: 'row', gap: 12, alignItems: 'center', borderBottomWidth: t.border.hairline, borderColor: t.color.bdSecondary }}>
    {leading}<View style={{ flex: 1 }}><Text style={[t.type.whyteSm, { color: t.color.txPrimary }]}>{label}</Text>
      {detail && <Text style={[t.type.whyteXxs, { color: t.color.txTertiary, marginTop: 3 }]}>{detail}</Text>}</View>{children}
  </View>;
}
export function Toggle({ label, value, onChange, detail, leading, disabled = false }: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
    detail?: string;
    disabled?: boolean;
    leading?: ReactNode;
}) {
    const t = useTheme();
    return <Row label={label} detail={detail} leading={leading}><Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onChange} trackColor={{ true: t.color.txAccent }}/></Row>;
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
    const t = useTheme();
    return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
    <Row label={label} detail={detail}><Text style={{ color: t.color.txTertiary, fontSize: 24 }}>›</Text></Row>
  </Pressable>;
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
    const t = useTheme();
    return <View style={{ marginVertical: 10 }}><Text style={[t.type.whyteSm, { color: t.color.txPrimary, marginBottom: 8 }]}>{label}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{options.map(([v, name]) => <Pressable key={v} accessibilityRole="radio" accessibilityLabel={`${label}: ${name}`} accessibilityState={{ checked: value === v }} onPress={() => onChange(v)} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: t.radius.md, backgroundColor: value === v ? t.color.bgSolidButton : t.color.bgSolidCardSecondary }}>
        <Text style={[t.type.whyteXs, { color: value === v ? t.color.txButton : t.color.txSecondary }]}>{name}</Text>
      </Pressable>)}</View>
  </View>;
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
    const t = useTheme();
    const button = (delta: number, text: string) => <Pressable accessibilityRole="button" accessibilityLabel={`${delta < 0 ? 'Decrease' : 'Increase'} ${label}`} disabled={delta < 0 ? value <= min : value >= max} onPress={() => onChange(Math.max(min, Math.min(max, Math.round((value + delta) * 100) / 100)))} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ color: t.color.txAccent, fontSize: 22 }}>{text}</Text></Pressable>;
    return <Row label={label}><View style={{ flexDirection: 'row', alignItems: 'center' }}>{button(-step, '−')}
    <Text accessibilityLiveRegion="polite" style={[t.type.fraktionXs, { color: t.color.txSecondary }]}>{Math.round(value * 100) / 100}{suffix}</Text>{button(step, '+')}</View></Row>;
}
