import {
  appearanceOverride,
  normalizeScheme,
  parseMode,
  resolveScheme,
} from '@/theme/theme-mode';
import { splashReady } from '@/theme/splash';
import { DAOUI_SOURCE_COMMIT, ROLE_COUNT, TYPE_SOURCE_COMMIT, themeFor } from '@/theme';
import { TYPE_STEP_COUNT, typeRamp } from '@/theme/type.gen';

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
  });
});

describe('the type ramp (daoUI type canon, 2026-08-05)', () => {
  it('is the generated scale, not a semantic table', () => {
    const theme = themeFor('light');
    // theme.type IS the generated ramp — no hand-declared semantic variants.
    expect(theme.type).toBe(typeRamp);
    expect(Object.keys(theme.type)).toHaveLength(TYPE_STEP_COUNT);
  });

  it('carries the canon values', () => {
    // whyte/sm is the reading register; the face switch to Inktrap at md is
    // inside the step, not the caller.
    expect(typeRamp.whyteSm).toEqual({ fontSize: 16, lineHeight: 24, fontFamily: 'ABCWhyteEdu-Book' });
    expect(typeRamp.whyteMd.fontFamily).toBe('ABCWhyteInktrap-Regular');
    // fraktion tracking: +2% of size, in points.
    expect(typeRamp.fraktionXxs.letterSpacing).toBe(0.18);
    expect(typeRamp.fraktionXs.letterSpacing).toBe(0.26);
    expect('letterSpacing' in typeRamp.whyteSm).toBe(false);
  });

  it('keeps the semantic names dead', () => {
    // The upstream law test deletes the semantic ramp in daoUI; this is the
    // consumer-side mirror, so a hand re-introduction fails loudly here too.
    const keys = Object.keys(typeRamp);
    for (const dead of ['display', 'title', 'heading', 'body', 'label', 'caption', 'mono', 'monoLabel']) {
      expect(keys).not.toContain(dead);
    }
  });

  it('stamps the type provenance', () => {
    expect(TYPE_SOURCE_COMMIT.length).toBeGreaterThan(0);
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
