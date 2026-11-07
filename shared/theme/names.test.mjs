import { describe, expect, it } from 'vitest';
import { displayName, modeSuffix, modeTitle } from './names.mjs';

describe('displayName', () => {
  it.each([
    [{ label: 'Base', group: 'Default' }, 'Base'],
    [{ label: 'Blue', group: 'Alpha' }, 'Alpha Blue'],
    [{ label: 'Default', group: 'Alpha' }, 'Alpha'],
    [{ label: 'Beta', group: 'Beta' }, 'Beta'],
    [{ label: 'Night', group: 'Other' }, 'Night'],
  ])('%j -> %s', (t, expected) => {
    expect(displayName(t)).toBe(expected);
  });
});

describe('modeSuffix and modeTitle', () => {
  it('handles both, dark-only and light-only', () => {
    expect([modeSuffix({ light: true, dark: true }), modeTitle({ light: true, dark: true })]).toEqual(['', undefined]);
    expect([modeSuffix({ light: false, dark: true }), modeTitle({ light: false, dark: true })]).toEqual([
      ' (dark only)',
      'Light mode uses the default light theme',
    ]);
    expect([modeSuffix({ light: true, dark: false }), modeTitle({ light: true, dark: false })]).toEqual([
      ' (light only)',
      'Dark mode uses the default dark theme',
    ]);
  });
});
