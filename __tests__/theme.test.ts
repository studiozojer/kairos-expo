import {
  appearanceOverride,
  normalizeScheme,
  parseMode,
  resolveScheme,
} from '@/theme/theme-mode';
import { splashReady } from '@/theme/splash';
import { DAOUI_SOURCE_COMMIT, ROLE_COUNT, themeFor } from '@/theme';

describe('themeFor', () => {
  it.each(['light', 'dark'] as const)('resolves every role in %s mode', (scheme) => {
    const theme = themeFor(scheme);
    expect(Object.keys(theme.color)).toHaveLength(ROLE_COUNT);
    for (const value of Object.values(theme.color)) {
      expect(typeof value).toBe('string');
      // Every role resolves to a RN-acceptable hex — a miss here means
      // sync-tokens emitted something broken, which renders as unstyled UI.
      expect(value).toMatch(/^#[0-9a-f]{8}$/);
    }
  });

  it('stamps the daoUI provenance', () => {
    // The stamp is what makes "has this drifted?" answerable: re-run
    // sync-tokens and diff. An empty stamp is a generator that failed quietly.
    expect(DAOUI_SOURCE_COMMIT.length).toBeGreaterThan(0);
  });

  it('carries the layout scales', () => {
    const theme = themeFor('light');
    expect(theme.space.md).toBe(12);
    expect(theme.radius.md).toBe(8);
    expect(theme.border.hairline).toBe(0.5);
    expect(theme.type.body.fontSize).toBe(16);
  });
});

describe('theme mode resolvers', () => {
  it('parses persisted modes, defaulting unknown to auto', () => {
    expect(parseMode('light')).toBe('light');
    expect(parseMode('dark')).toBe('dark');
    expect(parseMode('auto')).toBe('auto');
    expect(parseMode(null)).toBe('auto');
    expect(parseMode('system')).toBe('auto');
  });

  it('resolves forced modes over the system, auto follows it', () => {
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
    expect(resolveScheme('auto', 'dark')).toBe('dark');
  });

  it('normalizes RN scheme values', () => {
    expect(normalizeScheme('dark')).toBe('dark');
    expect(normalizeScheme('light')).toBe('light');
    expect(normalizeScheme(null)).toBe('light');
    expect(normalizeScheme(undefined)).toBe('light');
  });

  it('maps auto back to the system appearance', () => {
    expect(appearanceOverride('auto')).toBe('unspecified');
    expect(appearanceOverride('light')).toBe('light');
    expect(appearanceOverride('dark')).toBe('dark');
  });
});

describe('splashReady', () => {
  it('waits while fonts load', () => {
    expect(splashReady(false, null)).toBe(false);
  });

  it('proceeds when loaded', () => {
    expect(splashReady(true, null)).toBe(true);
  });

  it('proceeds in system fonts on error rather than hanging', () => {
    expect(splashReady(false, new Error('no faces'))).toBe(true);
  });
});
