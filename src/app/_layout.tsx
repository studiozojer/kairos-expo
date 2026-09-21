import { useFonts } from 'expo-font';
import { ThemeProvider } from 'expo-router/react-navigation';
import { Stack } from 'expo-router/stack';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactNode } from 'react';

import { ActiveChartsProvider } from '@/features/chart/active/ActiveChartsContext';
import { AuthProvider } from '@/auth/auth-context';
import { navThemeFor, useTheme } from '@/theme';
import { fontMap } from '@/theme/fonts.gen';
import { splashReady } from '@/theme/splash';
import { ThemeModeProvider } from '@/theme/theme-context';

SplashScreen.preventAutoHideAsync();

/**
 * The navigation chrome, themed from the same tokens as the content.
 *
 * A separate component rather than inline in RootLayout because it has to read
 * `useTheme()`, and that hook only sees the app-owned mode from *inside*
 * ThemeModeProvider. The inverse order would silently desync the chrome from
 * the screen it frames the moment the mode is held in context alone.
 */
function NavigationChrome({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <ThemeProvider value={navThemeFor(theme)}>{children}</ThemeProvider>;
}

/**
 * The root is a `Stack`, and the tab bar sits inside it.
 *
 * Anything that should leave the tab bar behind — a shared modal, a pushed
 * destination — registers on this stack: a screen registered above the tab bar
 * takes the bar with it when pushed (UIKit's `hidesBottomBarWhenPushed`,
 * obtained by structure rather than by a custom transition).
 *
 * The tabs screen hides its own header; each tab group draws its own once it
 * grows past a placeholder.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontMap);

  // splashReady() treats a font error as "proceed in system fonts" rather than
  // "wait forever" — gating on fontsLoaded alone turns a load failure into an
  // indefinite splash hang.
  const ready = splashReady(fontsLoaded, fontError);

  // preventAutoHideAsync() above holds the splash, so something has to release
  // it. Gated on `ready`: releasing while the early return below still holds
  // would trade the hang for a flash of blank screen.
  useEffect(() => {
    if (!ready) return;
    if (fontError) console.warn('Studio fonts failed to load; rendering in system fonts.', fontError);
    void SplashScreen.hideAsync();
  }, [ready, fontError]);

  // Render nothing until the faces are registered (or have failed — see
  // splashReady). A frame drawn before then renders in system font and then
  // reflows, which reads as a bug even though it corrects itself.
  if (!ready) return null;

  return (
    <ThemeModeProvider>
      <NavigationChrome>
        <AuthProvider>
          <ActiveChartsProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* Account is a modal on the ROOT stack: an occasional act that
                leaves the tabs behind, reachable from the journal home. */}
            <Stack.Screen name="charts" options={{ title: 'Saved charts', headerBackTitle: 'Chart' }} />
            <Stack.Screen name="chart-editor" options={{ title: 'Chart' }} />
            <Stack.Screen name="account" options={{ title: 'Account', presentation: 'modal' }} />
          </Stack>
          </ActiveChartsProvider>
        </AuthProvider>
      </NavigationChrome>
    </ThemeModeProvider>
  );
}
