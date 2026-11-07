import { test, expect } from 'vitest';
import { extractTokens, renderTokensCss, extractThemePair, applyTheme } from './tokens.mjs';

const css = `@layer base {\n  :root {\n    color-scheme: light;\n    --background: 210 17% 95%;\n    --radius: 0.5rem;\n  }\n  .dark {\n    --background: 213 10% 17%;\n  }\n}`;

test('extracts root and dark declarations', () => {
  const t = extractTokens(css);
  expect(t.light).toEqual({ background: '210 17% 95%', radius: '0.5rem' });
  expect(t.dark).toEqual({ background: '213 10% 17%' });
});

test('renders three selectors', () => {
  const out = renderTokensCss(extractTokens(css));
  expect(out).toContain(':root {');
  expect(out).toContain(':root[data-theme="dark"], .dark {');
  expect(out).toContain('@media (prefers-color-scheme: dark)');
  expect(out).toContain('--background: 213 10% 17%');
});

test('fails loudly when an anchor is missing', () => {
  expect(() => extractTokens(':root { --a: 1; }')).toThrow(/\.dark/);
});

const themesTs = `export const THEMES = [
  {
    id: 'alpha',
    label: 'Alpha',
    light: {
      background: '1 2% 3%',
      'card-foreground': '4 5% 6%',
      ...lightStatus,
      ring: '7 8% 9%',
    },
    dark: {
      background: '10 11% 12%',
      ...darkStatus,
    },
  },
  {
    id: 'beta',
    label: 'Beta',
    light: null,
    dark: { background: '0 0% 0%' },
  },
]`;

test('extractThemePair returns literal entries and skips spreads', () => {
  expect(extractThemePair(themesTs, 'alpha')).toEqual({
    light: { background: '1 2% 3%', 'card-foreground': '4 5% 6%', ring: '7 8% 9%' },
    dark: { background: '10 11% 12%' },
  });
});

test('extractThemePair throws for a one-mode theme', () => {
  expect(() => extractThemePair(themesTs, 'beta')).toThrow(/beta.*light/);
});

test('extractThemePair throws for an unknown id', () => {
  expect(() => extractThemePair(themesTs, 'nope')).toThrow("Theme 'nope' not found");
});

test('applyTheme overlays theme keys and keeps base-only keys', () => {
  const base = { light: { background: 'a', radius: '0.5rem' }, dark: { background: 'b', success: 'g' } };
  const out = applyTheme(base, { light: { background: 'x' }, dark: {} });
  expect(out.light).toEqual({ background: 'x', radius: '0.5rem' });
  expect(out.dark).toEqual({ background: 'b', success: 'g' });
});
