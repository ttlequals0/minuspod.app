import { describe, expect, it } from 'vitest';
import { parseThemeCookie, resolveMode, serializeThemeCookie } from './store.js';

describe('parseThemeCookie', () => {
  it('reads pair and mode', () => {
    expect(
      parseThemeCookie('a=1; minuspod-theme=catppuccin-mocha.dark; b=2', ['nord', 'catppuccin-mocha']),
    ).toEqual({ pair: 'catppuccin-mocha', mode: 'dark' });
  });
  it('falls back for an unknown pair and a bad mode', () => {
    expect(parseThemeCookie('minuspod-theme=gone.purple', ['nord'])).toEqual({ pair: 'nord', mode: 'system' });
  });
  it('treats a doubled equals as an unknown pair', () => {
    expect(parseThemeCookie('minuspod-theme==dracula', ['nord', 'dracula'])).toEqual({ pair: 'nord', mode: 'system' });
  });
  it('accepts a pair with no mode', () => {
    expect(parseThemeCookie('minuspod-theme=dracula', ['nord', 'dracula'])).toEqual({ pair: 'dracula', mode: 'system' });
  });
  it('falls back for garbage and for no cookie', () => {
    for (const c of ['minuspod-theme=.', '', 'minuspod-theme=']) {
      expect(parseThemeCookie(c, ['nord'])).toEqual({ pair: 'nord', mode: 'system' });
    }
  });
});

describe('serializeThemeCookie', () => {
  it('scopes to the parent domain only on minuspod.app hosts', () => {
    const c = { pair: 'nord', mode: 'light' };
    expect(serializeThemeCookie(c, 'docs.minuspod.app')).toBe(
      'minuspod-theme=nord.light; Path=/; Max-Age=31536000; SameSite=Lax; Domain=minuspod.app',
    );
    expect(serializeThemeCookie(c, 'minuspod.app')).toContain('Domain=minuspod.app');
    expect(serializeThemeCookie(c, 'localhost')).not.toContain('Domain');
    expect(serializeThemeCookie(c, 'minuspod.app.evil.example')).not.toContain('Domain');
  });
});

describe('resolveMode', () => {
  it('resolves system by preference', () => {
    expect(resolveMode('system', true)).toBe('dark');
    expect(resolveMode('system', false)).toBe('light');
    expect(resolveMode('light', true)).toBe('light');
  });
});
