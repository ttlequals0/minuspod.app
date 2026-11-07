import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COOKIE_NAME } from './config.mjs';

const src = readFileSync(new URL('./bootstrap.js', import.meta.url), 'utf8');

function run(cookie, dark) {
  const root = { dataset: {} };
  const mq = { matches: dark, listeners: [], addEventListener(_, fn) { this.listeners.push(fn); } };
  new Function('document', 'window', src)({ cookie, documentElement: root }, { matchMedia: () => mq });
  const flip = (matches) => mq.listeners.forEach((fn) => fn({ matches }));
  return { root, flip };
}

describe('bootstrap behaviour', () => {
  it('system with dark media gives dark and keeps the pair', () => {
    const { root } = run('x=1; minuspod-theme=dracula.system', true);
    expect(root.dataset.pair).toBe('dracula');
    expect(root.dataset.theme).toBe('dark');
  });
  it('explicit light beats dark media', () => {
    expect(run('minuspod-theme=nord.light', true).root.dataset.theme).toBe('light');
  });
  it('media change updates theme in system mode', () => {
    const { root, flip } = run('minuspod-theme=nord.system', true);
    flip(false);
    expect(root.dataset.theme).toBe('light');
  });
  it('media change is ignored while the mode is explicit and resumes on system', () => {
    const { root, flip } = run('', false);
    root.dataset.themeMode = 'dark';
    flip(true);
    expect(root.dataset.theme).toBe('light');
    root.dataset.themeMode = 'system';
    flip(true);
    expect(root.dataset.theme).toBe('dark');
  });
  it('uses the configured cookie name and stays dependency-free', () => {
    expect(src).toContain(`'${COOKIE_NAME}='`);
    expect(src).not.toContain('import ');
  });
});
