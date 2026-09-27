import type { ActionContext } from './actionRegistry';
export function context(): ActionContext {
  return {
    enabled: true, settingsEnabled: true, chartEnabled: true, capturing: false, locked: true,
    hasTarget: true, targetKind: 'saved', canStepBackward: true, canStepForward: true,
    aspects: { enabled: true, showPatterns: true, showFalseAspects: false },
    openSettings: jest.fn(), openDisplay: jest.fn(), toggleOrientation: jest.fn(), screenshot: jest.fn(),
    toggleDisplay: jest.fn(), step: jest.fn(), reset: jest.fn(),
  };
}
