import type { ViewProps } from 'react-native';
import { useFieldTheme } from './theme';
import { MenuView } from '@react-native-menu/menu';
import type { PickerControlProps } from './PickerControl.types';

/** Native menu owns presentation, dismissal, selection and accessibility. */
export function PickerControl({ label, value, options, onChange, disabled, children }: PickerControlProps) {
  const theme = useFieldTheme();
  const accessibility: Pick<ViewProps, 'accessible' | 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityValue' | 'accessibilityState' | 'pointerEvents'> = {
    accessible: true, accessibilityRole: 'button', accessibilityLabel: label,
    accessibilityValue: { text: options.find(option => option.value === value)?.label ?? value },
    accessibilityState: { disabled: !!disabled }, pointerEvents: disabled ? 'none' : 'auto',
  };
  return <MenuView themeVariant={theme.scheme} {...accessibility}
    title={label} shouldOpenOnLongPress={false}
    actions={disabled ? [] : options.map(option => ({ id: option.value, title: option.label, state: option.value === value ? 'on' : 'off', attributes: { disabled: !!option.disabled } }))}
    onPressAction={({ nativeEvent: { event } }) => { if (!disabled && options.some(option => option.value === event && !option.disabled)) onChange(event); }}>
    {children}
  </MenuView>;
}
