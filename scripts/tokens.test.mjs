import { test, expect } from 'vitest';
import { extractTokens, renderTokensCss } from './tokens.mjs';

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
