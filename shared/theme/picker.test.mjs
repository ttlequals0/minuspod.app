import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initThemePicker } from './picker.js';

function fakeSelect(values) {
  const handlers = [];
  const label = { style: { setProperty() {} } };
  return {
    value: values[0],
    options: values.map((value) => ({ value })),
    selectedOptions: [{ dataset: {} }],
    closest: () => label,
    addEventListener: (_, fn) => handlers.push(fn),
    change(value) {
      this.value = value;
      handlers.forEach((fn) => fn());
    },
  };
}

describe('initThemePicker with two instances', () => {
  let doc, pairs, modes, root;
  beforeEach(() => {
    doc = {
      cookie: 'minuspod-theme=dracula.dark',
      documentElement: { dataset: {} },
      querySelector: () => null,
      dispatchEvent: () => true,
    };
    vi.stubGlobal('document', doc);
    vi.stubGlobal('location', { hostname: 'localhost' });
    vi.stubGlobal('CustomEvent', class { constructor(type, init) { this.type = type; this.detail = init?.detail; } });
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    pairs = [fakeSelect(['nord', 'dracula']), fakeSelect(['nord', 'dracula'])];
    modes = [fakeSelect(['light', 'dark', 'system']), fakeSelect(['light', 'dark', 'system'])];
    root = {
      querySelectorAll: (sel) => (sel.includes('pair') ? pairs : modes),
    };
    initThemePicker(root);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('applies the stored choice to both instances', () => {
    expect(pairs.map((p) => p.value)).toEqual(['dracula', 'dracula']);
    expect(modes.map((m) => m.value)).toEqual(['dark', 'dark']);
    expect(doc.documentElement.dataset.pair).toBe('dracula');
  });
  it('syncs a pair change from either instance', () => {
    pairs[1].change('nord');
    expect(doc.documentElement.dataset.pair).toBe('nord');
    expect(pairs[0].value).toBe('nord');
    expect(doc.cookie).toContain('minuspod-theme=nord.dark');
  });
  it('syncs a mode change from either instance', () => {
    modes[1].change('light');
    expect(doc.documentElement.dataset.theme).toBe('light');
    expect(modes[0].value).toBe('light');
    expect(doc.cookie).toContain('dracula.light');
  });
});
