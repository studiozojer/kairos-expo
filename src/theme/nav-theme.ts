import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from 'expo-router';

import { families } from './fonts.gen';
import type { Theme } from './index';

/**
 * The navigation chrome, derived from the same tokens as the content.
 *
 * Built by overriding `DefaultTheme`/`DarkTheme` rather than by constructing a
 * `Theme` literal: react-navigation adds keys across versions, and a literal
 * would leave any key we do not know about undefined rather than merely stock.
 * (The stock themes are how you get a pure-white header in system font above
 * warm cream content — daoUI's bench found that bug the hard way.)
 *
 * Fonts: every weight is declared `normal` because the family is already the
 * weight — asking iOS for `600` on a named PostScript face makes it synthesise
 * a bold rather than pick a sibling cut that does not exist here.
 */
export function navThemeFor(theme: Theme): NavigationTheme {
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const whyte = { book: families.whyte.book, display: families.whyte.display };

  return {
    ...base,
    dark: theme.scheme === 'dark',
    colors: {
      ...base.colors,
      // The scene background, which is what a screen that sets none of its own
      // shows through.
      background: theme.color.bgSolidBase,
      // Headers, tab bars and modal cards.
      card: theme.color.bgSolidCard,
      text: theme.color.txPrimary,
      border: theme.color.bdCard,
      // The tint on header buttons and back chevrons.
      primary: theme.color.txAccent,
      notification: theme.color.txError,
    },
    fonts: {
      regular: { fontFamily: whyte.book, fontWeight: 'normal' },
      medium: { fontFamily: whyte.book, fontWeight: 'normal' },
      bold: { fontFamily: whyte.display, fontWeight: 'normal' },
      heavy: { fontFamily: whyte.display, fontWeight: 'normal' },
    },
  };
}
