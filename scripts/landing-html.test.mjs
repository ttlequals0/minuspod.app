import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const file = new URL('../landing/dist/index.html', import.meta.url);
const built = existsSync(file);
const html = built ? readFileSync(file, 'utf8') : '';

describe.skipIf(!built)('landing built html (build landing first)', () => {
  test('landing header renders the theme picker with the default pair selected', () => {
    expect(html).toContain('<select data-theme-pair');
    expect(html).toContain('<option disabled>Same themes as the MinusPod app</option>');
    expect(html).toMatch(/<option value="nord"[^>]*selected/);
    expect(html).toContain('<optgroup label="');
    expect(html).toContain('data-theme-mode');
    expect(html).toMatch(/<option value="system"[^>]*selected|<option[^>]*selected[^>]*value="system"/);
  });

  test('bootstrap script is inlined before the stylesheet', () => {
    const boot = html.indexOf('dataset.pair');
    const sheet = Math.min(...['<link rel="stylesheet"', '<style'].map((s) => html.indexOf(s)).filter((i) => i >= 0));
    expect(boot).toBeGreaterThan(-1);
    expect(boot).toBeLessThan(sheet);
  });

  test('logo switches on data-theme', () => {
    expect(html).toContain('class="logo-light"');
    expect(html).toContain('class="logo-dark"');
  });
});
