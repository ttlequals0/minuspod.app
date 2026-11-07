import { COOKIE_DOMAIN, COOKIE_NAME, DEFAULT_PAIR } from './config.mjs';

const MODES = ['light', 'dark', 'system'];

export function parseThemeCookie(cookieHeader, pairIds) {
  const prefix = `${COOKIE_NAME}=`;
  const entry = String(cookieHeader || '')
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(prefix));
  const [pair, mode] = entry ? entry.slice(prefix.length).split('.') : [];
  return {
    pair: pairIds.includes(pair) ? pair : DEFAULT_PAIR,
    mode: MODES.includes(mode) ? mode : 'system',
  };
}

export function serializeThemeCookie({ pair, mode }, hostname) {
  const onSite = hostname === COOKIE_DOMAIN || hostname.endsWith(`.${COOKIE_DOMAIN}`);
  const base = `${COOKIE_NAME}=${pair}.${mode}; Path=/; Max-Age=31536000; SameSite=Lax`;
  return onSite ? `${base}; Domain=${COOKIE_DOMAIN}` : base;
}

export function resolveMode(mode, prefersDark) {
  if (mode === 'light' || mode === 'dark') return mode;
  return prefersDark ? 'dark' : 'light';
}

export function readTheme(pairIds) {
  try {
    return parseThemeCookie(document.cookie, pairIds);
  } catch {
    return { pair: DEFAULT_PAIR, mode: 'system' };
  }
}

export function writeTheme(choice) {
  try {
    document.cookie = serializeThemeCookie(choice, location.hostname);
  } catch {
    // cookies blocked: choice just does not persist
  }
}
