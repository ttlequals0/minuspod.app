import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { DEFAULT_PAIR } from '../shared/theme/config.mjs';

function page(path) {
  const file = new URL(path, import.meta.url);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  if (process.env.CI) throw new Error(`${path} missing: run the build before npm test`);
  return null;
}

const html = page('../landing/dist/index.html');
const docsHtml = page('../docs/dist/index.html');
const defaultPressed = new RegExp(`data-theme-pair="${DEFAULT_PAIR}"[^>]*aria-pressed="true"`);

describe.skipIf(!html)('landing built html (build landing first)', () => {
  test('landing header renders the theme picker with the default pair pressed', () => {
    expect(html).toContain('<details class="theme-pair">');
    expect(html).toContain('Same themes as the MinusPod app');
    expect(html).toMatch(defaultPressed);
    expect(html).toContain('class="theme-group-title"');
    expect(html).toContain('data-theme-mode aria-label="Toggle theme"');
  });

  test('bootstrap script is inlined before the stylesheet', () => {
    const boot = html.indexOf('dataset.pair');
    const sheet = Math.min(...['<link rel="stylesheet"', '<style'].map((s) => html.indexOf(s)).filter((i) => i >= 0));
    expect(sheet).toBeLessThan(Infinity);
    expect(boot).toBeGreaterThan(-1);
    expect(boot).toBeLessThan(sheet);
  });

  test('logo switches on data-theme', () => {
    expect(html).toContain('class="logo-light"');
    expect(html).toContain('class="logo-dark"');
  });
});

describe.skipIf(!docsHtml)('docs built html (build docs first)', () => {
  test('docs header renders the shared picker', () => {
    expect(docsHtml).toContain('Same themes as the MinusPod app');
    expect(docsHtml).toMatch(defaultPressed);
    expect(docsHtml).toContain('data-theme-mode aria-label="Toggle theme"');
  });

  test('docs renders the picker in header and mobile menu', () => {
    expect(docsHtml.match(/<details class="theme-pair">/g)).toHaveLength(2);
  });

  test('docs inline Starlight theme provider is replaced', () => {
    expect(docsHtml).toContain('dataset.pair');
    expect(docsHtml).not.toContain('starlight-theme');
  });
});
