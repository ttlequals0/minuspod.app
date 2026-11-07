import { test, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractTokens, loadThemes, pairVars, renderTokensCss, renderThemesJson } from './tokens.mjs';

const css = `@layer base {\n  :root {\n    color-scheme: light;\n    --background: 210 17% 95%;\n    --radius: 0.5rem;\n  }\n  .dark {\n    --background: 213 10% 17%;\n  }\n}`;

test('extracts root and dark declarations', () => {
  const t = extractTokens(css);
  expect(t.light).toEqual({ background: '210 17% 95%', radius: '0.5rem' });
  expect(t.dark).toEqual({ background: '213 10% 17%' });
});

test('fails loudly when an anchor is missing', () => {
  expect(() => extractTokens(':root { --a: 1; }')).toThrow(/\.dark/);
});

test('extractTokens ignores declarations inside comments', () => {
  const commented = `:root {\n  /* --old: 1 2% 3%; */\n  --background: 1 1% 1%;\n}\n.dark { /* } */ --background: 2 2% 2%; }`;
  expect(extractTokens(commented)).toEqual({ light: { background: '1 1% 1%' }, dark: { background: '2 2% 2%' } });
});

const fixtureTs = `export const THEME_VAR_KEYS = ['background', 'foreground'] as const;
export type ThemeVarKey = (typeof THEME_VAR_KEYS)[number];
export type ThemeGroup = 'Default' | 'Alpha' | 'Beta';
interface ThemePair { id: string; label: string; group: ThemeGroup; light: Record<string, string> | null; dark: Record<string, string> | null; accentColor: string }
export const THEME_GROUPS: ThemeGroup[] = ['Default', 'Alpha', 'Beta'];
const shared = { foreground: '0 0% 10%' };
const alphaLight = { background: '1 1% 90%', ...shared };
export const THEMES: ThemePair[] = [
  { id: 'slate', label: 'Slate', group: 'Default', light: null, dark: null, accentColor: '#111111' },
  { id: 'beta-dark', label: 'Beta Dark', group: 'Beta', light: null, dark: { background: '3 3% 10%', foreground: '0 0% 95%' }, accentColor: '#333333' },
  { id: 'alpha', label: 'Alpha', group: 'Alpha', light: alphaLight, dark: { background: '2 2% 10%', ...shared }, accentColor: '#222222' },
];
if (import.meta.env.DEV) { console.error('dev only'); }
`;

const base = {
  light: { background: 'L', foreground: 'LF', radius: '1' },
  dark: { background: 'D', foreground: 'DF', radius: '1' },
};
let dir;
let scratch;
let themes;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'tokens-'));
  const src = join(dir, 'themes.ts');
  scratch = join(dir, 'themes.import.ts');
  writeFileSync(src, fixtureTs);
  themes = await loadThemes(src, scratch);
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

test('loadThemes imports a TypeScript themes file with the dev guard removed', () => {
  expect(themes.THEMES.length).toBe(3);
  expect(themes.THEMES[2].light.foreground).toBe('0 0% 10%');
  expect(themes.THEME_VAR_KEYS.length).toBe(2);
  expect(readFileSync(scratch, 'utf8')).not.toContain('import.meta.env');
});

test('pairVars falls back to base values for a missing mode', () => {
  const out = pairVars(base, themes.THEMES[1]);
  expect(out.light).toEqual(base.light);
  expect(out.dark.background).toBe('3 3% 10%');
  expect(out.dark.radius).toBe('1');
});

test('renderTokensCss emits the default pair first and one block per pair and mode', () => {
  const out = renderTokensCss({ base, themes: themes.THEMES, defaultPair: 'alpha' });
  expect(out.startsWith('/* Generated from MinusPod frontend/src/index.css and themes.ts. Do not edit. */')).toBe(true);
  const block = (sel) => {
    const i = out.indexOf(sel);
    return out.slice(i, out.indexOf('}', i));
  };
  expect(block(':root {')).toContain('--background: 1 1% 90%;');
  expect(block(':root[data-theme="dark"] {')).toContain('--background: 2 2% 10%;');
  expect(block(':root[data-pair="beta-dark"] {')).toContain('--background: L;');
  expect(block(':root[data-pair="beta-dark"][data-theme="dark"] {')).toContain('--background: 3 3% 10%;');
  expect(out.indexOf(':root[data-pair="slate"]')).toBeGreaterThan(out.indexOf('prefers-color-scheme'));
  expect(out).not.toContain('.dark');
});

test('renderTokensCss throws for an unknown default pair', () => {
  expect(() => renderTokensCss({ base, themes: themes.THEMES, defaultPair: 'nope' })).toThrow("Default pair 'nope' not found in themes.ts");
});

test('renderThemesJson orders by group then source and records mode availability', () => {
  const out = JSON.parse(renderThemesJson(themes, 'alpha'));
  expect(out.themes.map((t) => t.id)).toEqual(['slate', 'alpha', 'beta-dark']);
  expect(out.themes[2]).toEqual({ id: 'beta-dark', label: 'Beta Dark', group: 'Beta', accentColor: '#333333', light: false, dark: true });
  expect(out.defaultPair).toBe('alpha');
  expect(out.groups).toEqual(['Default', 'Alpha', 'Beta']);
});
