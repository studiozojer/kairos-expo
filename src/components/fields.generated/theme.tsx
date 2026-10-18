import { createContext, useContext, type ReactNode } from 'react';
import type { TextStyle } from 'react-native';

export type FieldTheme = {
  scheme?: 'light' | 'dark';
  color: Record<'txPrimary' | 'txSecondary' | 'txDisabled' | 'txAccent' | 'txError' | 'icAccent' | 'icPrimary' | 'icDisabled' | 'icTertiary' | 'bgSecondary' | 'bgSolidCard' | 'bgSolidCardPressed' | 'bdPrimary', string>;
  type: Record<'whyteSm' | 'whyteXs', TextStyle>;
  space: { xs: number; sm: number; md: number; lg: number; xxl: number };
  radius: { md: number; xl: number };
  border: { hairline: number };
};
const Context = createContext<FieldTheme | null>(null);
export function FieldProvider({ theme, children }: { theme: FieldTheme; children: ReactNode }) {
  return <Context.Provider value={theme}>{children}</Context.Provider>;
}
export function useFieldTheme() {
  const value = useContext(Context);
  if (!value) throw new Error('daoUI fields require FieldProvider');
  return value;
}
