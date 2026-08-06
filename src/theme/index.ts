import { useColorScheme } from 'react-native';

import { useThemeMode } from './theme-context';
import { DAOUI_SOURCE_COMMIT, ROLE_COUNT, darkColors, lightColors, type ColorRole } from './tokens.gen';
import { TYPE_SOURCE_COMMIT, typeRamp, type TypeStep } from './type.gen';

export { DAOUI_SOURCE_COMMIT, ROLE_COUNT, TYPE_SOURCE_COMMIT, type ColorRole, type TypeStep };

// Re-exported so `@/theme` stays the single styling entry point. The import
// back into this module from `nav-theme` is type-only, so there is no runtime
// cycle here.
export { navThemeFor } from './nav-theme';

/**
 * Layout scales.
 *
 * Not from daoUI: it publishes colour primitives and semantics only, with no
 * layout layer — `DesignTokens.swift` holds spacing, radius and border in Swift
 * where no non-Swift consumer can read them. Declared here and named as this
 * app's own, which is at least true. Extracting a neutral layout layer is a
 * daoUI change; until it lands, keep these scales identical across the Expo
 * apps.
 *
 * KNOWN DRIFT (board, 2026-08-05): daoUI's `radius` ramp reads 6 in Figma and
 * 8 in code at `md` — offset one rung, undetectable from either side. The
 * verdict is David's. Until it lands, this file follows the CODE ramp.
 */
export const space = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

export const border = {
  hairline: 0.5,
  thin: 1,
  medium: 1.5,
} as const;

/**
 * The type ramp IS daoUI's type canon — generated from `type.json` by
 * `npm run sync-type`, never declared here. Scale names (`whyte/lg`,
 * `fraktion/xs`) mirror the Figma styles flat; the semantic ramp
 * (`display`/`title`/`heading`…) was deleted upstream on 2026-08-05 and a law
 * test keeps it dead. The family carries the voice and the step carries the
 * size: the whyte face switch (Inktrap for display registers, Edu Book for
 * reading registers) lives inside the step, not at the call site.
 */
export const type = typeRamp;

export type Space = keyof typeof space;
export type Radius = keyof typeof radius;
export type BorderWidth = keyof typeof border;

export type Theme = {
  scheme: 'light' | 'dark';
  color: Record<ColorRole, string>;
  space: typeof space;
  radius: typeof radius;
  border: typeof border;
  type: typeof typeRamp;
};

export function themeFor(scheme: 'light' | 'dark'): Theme {
  return {
    scheme,
    color: scheme === 'dark' ? darkColors : lightColors,
    space,
    radius,
    border,
    type,
  };
}

/**
 * The app's single styling entry point. Every component reads colours from
 * here; a literal hex anywhere else is a bug, because it cannot follow daoUI
 * when daoUI moves.
 *
 * Reads the app-owned mode when a provider is present so the override applies,
 * and falls back to the raw system scheme otherwise (a test, or a component
 * rendered outside the tree). Both hooks run unconditionally, per the rules of
 * hooks.
 */
export function useTheme(): Theme {
  const themed = useThemeMode();
  const system = useColorScheme();
  return themeFor(themed?.scheme ?? (system === 'dark' ? 'dark' : 'light'));
}
