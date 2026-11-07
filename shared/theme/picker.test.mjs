import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initThemePicker } from './picker.js';

function fakeMenu() {
  const name = { textContent: '' };
  const summary = { focused: false, focus() { this.focused = true; } };
  const menu = {
    open: true,
    name,
    summary,
    listeners: {},
    style: { props: {}, setProperty(k, v) { this.props[k] = v; } },
    querySelector: (sel) => (sel === 'summary' ? summary : name),
    contains: (el) => !!el && el.menu === menu,
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); },
  };
  return menu;
}

function fakeButton(menu, dataset, text) {
  const handlers = [];
  return {
    dataset,
    attrs: {},
    querySelector: () => ({ textContent: text }),
    setAttribute(k, v) { this.attrs[k] = v; },
    closest: () => menu,
    addEventListener: (_, fn) => handlers.push(fn),
    click() { handlers.forEach((fn) => fn()); },
  };
}

describe('initThemePicker with two instances', () => {
  let doc, menus, pairs, modes, winListeners, docListeners;
  beforeEach(() => {
    menus = [fakeMenu(), fakeMenu()];
    pairs = menus.flatMap((m) => [
      fakeButton(m, { themePair: 'nord', accent: '#88c0d0' }, 'Nord'),
      fakeButton(m, { themePair: 'dracula', accent: '#ff79c6' }, 'Dracula'),
    ]);
    modes = menus.map((m) => fakeButton(m, { themeMode: '' }, ''));
    docListeners = {};
    doc = {
      cookie: 'minuspod-theme=dracula.dark',
      documentElement: { dataset: {} },
      addEventListener: (type, fn) => (docListeners[type] ??= []).push(fn),
    };
    vi.stubGlobal('document', doc);
    vi.stubGlobal('location', { hostname: 'localhost' });
    winListeners = {};
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
      addEventListener: (type, fn) => (winListeners[type] ??= []).push(fn),
    });
    initThemePicker({ querySelectorAll: (sel) => (sel.includes('pair]') ? pairs : sel.includes('mode') ? modes : menus) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('applies the stored choice to the root and both instances', () => {
    expect(doc.documentElement.dataset).toEqual({ pair: 'dracula', themeMode: 'dark', theme: 'dark' });
    expect(pairs.map((b) => b.attrs['aria-pressed'])).toEqual(['false', 'true', 'false', 'true']);
    expect(menus.map((m) => m.name.textContent)).toEqual(['Dracula', 'Dracula']);
    expect(menus.map((m) => m.style.props['--theme-accent'])).toEqual(['#ff79c6', '#ff79c6']);
  });
  it('a pick in either instance updates both, stores it and closes the menu', () => {
    pairs[2].click();
    expect(doc.documentElement.dataset.pair).toBe('nord');
    expect(doc.cookie).toContain('minuspod-theme=nord.dark');
    expect(pairs.map((b) => b.attrs['aria-pressed'])).toEqual(['true', 'false', 'true', 'false']);
    expect(menus.map((m) => m.name.textContent)).toEqual(['Nord', 'Nord']);
    expect(menus.map((m) => m.open)).toEqual([false, false]);
    expect(menus[1].summary.focused).toBe(true);
  });
  it('the toggle commits the opposite of the shown theme', () => {
    modes[1].click();
    expect(doc.documentElement.dataset).toMatchObject({ themeMode: 'light', theme: 'light' });
    expect(doc.cookie).toContain('dracula.light');
    modes[0].click();
    expect(doc.documentElement.dataset.theme).toBe('dark');
  });
  it('the first toggle from system mode uses the resolved theme', () => {
    doc.cookie = '';
    winListeners.pageshow.forEach((fn) => fn({ persisted: true }));
    expect(doc.documentElement.dataset).toEqual({ pair: 'nord', themeMode: 'system', theme: 'light' });
    modes[0].click();
    expect(doc.cookie).toContain('minuspod-theme=nord.dark');
  });
  it('ignores a non-persisted pageshow', () => {
    doc.cookie = 'minuspod-theme=nord.light';
    winListeners.pageshow.forEach((fn) => fn({ persisted: false }));
    expect(doc.documentElement.dataset.pair).toBe('dracula');
  });
  it('closes open menus on an outside click and on Escape', () => {
    docListeners.click.forEach((fn) => fn({ target: {} }));
    expect(menus.map((m) => m.open)).toEqual([false, false]);
    menus[0].open = true;
    docListeners.keydown.forEach((fn) => fn({ key: 'Escape' }));
    expect(menus[0].open).toBe(false);
    expect(menus[0].summary.focused).toBe(false);
  });
  it('Escape moves focus to the trigger when focus was inside the list', () => {
    doc.activeElement = { menu: menus[0] };
    docListeners.keydown.forEach((fn) => fn({ key: 'Escape' }));
    expect(menus.map((m) => m.open)).toEqual([false, false]);
    expect(menus.map((m) => m.summary.focused)).toEqual([true, false]);
  });
  it('tabbing out of an open list closes it, moving within it or losing the window does not', () => {
    const blur = (m, relatedTarget) => m.listeners.focusout.forEach((fn) => fn({ relatedTarget }));
    blur(menus[0], { menu: menus[0] });
    blur(menus[1], null);
    expect(menus.map((m) => m.open)).toEqual([true, true]);
    blur(menus[0], {});
    expect(menus.map((m) => m.open)).toEqual([false, true]);
  });
});
