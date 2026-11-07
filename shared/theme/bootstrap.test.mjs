import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync(new URL('./bootstrap.js', import.meta.url), 'utf8');

function run(cookie, dark) {
  const root = { dataset: {} };
  const meta = { content: '', setAttribute(_, v) { this.content = v; } };
  const mq = { matches: dark, listeners: [], addEventListener(_, fn) { this.listeners.push(fn); } };
  const document = { cookie, documentElement: root, querySelector: () => meta };
  new Function('document', 'window', src)(document, { matchMedia: () => mq });
  const flip = (matches) => mq.listeners.forEach((fn) => fn({ matches }));
  return { root, meta, flip };
}

describe('bootstrap behaviour', () => {
  it('system with dark media gives dark and keeps the pair', () => {
    const { root, meta } = run('x=1; minuspod-theme=dracula.system', true);
    expect(root.dataset.pair).toBe('dracula');
    expect(root.dataset.theme).toBe('dark');
    expect(meta.content).toBe('dark');
  });
  it('explicit light beats dark media', () => {
    expect(run('minuspod-theme=nord.light', true).root.dataset.theme).toBe('light');
  });
  it('media change updates theme in system mode', () => {
    const { root, flip } = run('minuspod-theme=nord.system', true);
    flip(false);
    expect(root.dataset.theme).toBe('light');
  });
  it('media change is ignored after an explicit mode', () => {
    const { root, flip } = run('minuspod-theme=nord.light', false);
    flip(true);
    expect(root.dataset.theme).toBe('light');
  });
  it('media change is ignored once the picker sets an explicit mode', () => {
    const { root, flip } = run('', false);
    root.dataset.themeMode = 'dark';
    flip(true);
    expect(root.dataset.theme).toBe('light');
    root.dataset.themeMode = 'system';
    flip(true);
    expect(root.dataset.theme).toBe('dark');
  });
});
