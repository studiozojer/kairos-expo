import type { ReactNode } from 'react';
export type FieldOption = { value: string; label: string; disabled?: boolean };
export type PickerControlProps = {
  label: string; value: string; options: readonly FieldOption[];
  onChange: (value: string) => void; disabled?: boolean; children: ReactNode;
};
