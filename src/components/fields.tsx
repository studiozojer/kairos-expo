import type { ComponentType } from 'react';
import { useTheme } from '@/theme';
import * as Fields from './fields.generated';

/** Inject the app's resolved daoUI tokens, including in independently hosted sheets. */
function themed<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  function AppField(props: P) {
    const t = useTheme();
    return <Fields.FieldProvider theme={{ scheme: t.scheme, color: t.color, type: t.type, space: t.space, radius: t.radius, border: t.border }}>
      <Component {...props} />
    </Fields.FieldProvider>;
  }
  AppField.displayName = `App${Component.displayName ?? Component.name}`;
  return AppField;
}
export const FieldSection = themed(Fields.FieldSection);
export const FieldRow = themed(Fields.FieldRow);
export const FieldToggle = themed(Fields.FieldToggle);
export const FieldNavigation = themed(Fields.FieldNavigation);
export const FieldPicker = themed(Fields.FieldPicker);
export const FieldStepper = themed(Fields.FieldStepper);
export const FieldText = themed(Fields.FieldText);
export const FieldColor = themed(Fields.FieldColor);
