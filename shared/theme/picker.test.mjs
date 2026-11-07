import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initThemePicker } from './picker.js';

function fakeSelect(values) {
  const handlers = [];
  const label = { style: { setProperty: vi.fn(), removeProperty: vi.fn() } };
  return {
    value: values[0],
    options: values.map((value) => ({ value })),
    selectedOptions: [{ dataset: { accent: '#123456' } }],
    label,
    closest: () => label,
    addEventListener: (_, fn) => handlers.push(fn),
    change(value) {
      this.value = value;
      handlers.forEach((fn) => fn());
    },
  };
}

describe('initThemePicker with two instances', () => {
  let doc, pairs, modes, root, listeners;
  beforeEach(() => {
    doc = {
      cookie: 'minuspod-theme=dracula.dark',
      documentElement: { dataset: {} },
    };
    vi.stubGlobal('document', doc);
    vi.stubGlobal('location', { hostname: 'localhost' });
    listeners = {};
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
      addEventListener: (type, fn) => (listeners[type] ??= []).push(fn),
    });
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
  it('sets the accent on every instance label', () => {
    pairs.forEach((p) => expect(p.label.style.setProperty).toHaveBeenCalledWith('--theme-accent', '#123456'));
  });
  it('re-reads the cookie on a persisted pageshow', () => {
    doc.cookie = 'minuspod-theme=nord.light';
    listeners.pageshow.forEach((fn) => fn({ persisted: true }));
    expect(pairs.map((p) => p.value)).toEqual(['nord', 'nord']);
    expect(modes.map((m) => m.value)).toEqual(['light', 'light']);
    expect(doc.documentElement.dataset.pair).toBe('nord');
    expect(doc.documentElement.dataset.theme).toBe('light');
  });
  it('ignores a non-persisted pageshow', () => {
    doc.cookie = 'minuspod-theme=nord.light';
    listeners.pageshow.forEach((fn) => fn({ persisted: false }));
    expect(pairs.map((p) => p.value)).toEqual(['dracula', 'dracula']);
    expect(doc.documentElement.dataset.pair).toBe('dracula');
  });
});
