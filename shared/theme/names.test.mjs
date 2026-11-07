import { describe, expect, it } from 'vitest';
import { displayName, modeSuffix, modeTitle } from './names.mjs';

describe('displayName', () => {
  it.each([
    [{ id: 'slate', label: 'Slate', group: 'Default' }, 'Slate'],
    [{ id: 'catppuccin-mocha', label: 'Mocha', group: 'Catppuccin' }, 'Catppuccin Mocha'],
    [{ id: 'dracula', label: 'Default', group: 'Dracula' }, 'Dracula'],
    [{ id: 'dracula-pink', label: 'Pink', group: 'Dracula' }, 'Dracula Pink'],
    [{ id: 'nord', label: 'Nord', group: 'Nord' }, 'Nord'],
    [{ id: 'kanagawa', label: 'Wave', group: 'Kanagawa' }, 'Kanagawa Wave'],
    [{ id: 'tokyo-night', label: 'Tokyo Night', group: 'Other' }, 'Tokyo Night'],
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
