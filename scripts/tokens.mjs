import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mainDir } from './lib/main-dir.mjs';

export const SITE_THEME = 'nord';

function extractBlock(css, anchor) {
  const start = css.indexOf(anchor);
  if (start === -1) throw new Error(`Anchor "${anchor}" not found in index.css`);
  let depth = 1;
  let i = start + anchor.length;
  const bodyStart = i;
  for (; i < css.length && depth > 0; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
  }
  if (depth !== 0) throw new Error(`Unclosed block for anchor "${anchor}"`);
  const body = css.slice(bodyStart, i - 1);
  const out = {};
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

export function extractTokens(css) {
  return { light: extractBlock(css, ':root {'), dark: extractBlock(css, '.dark {') };
}

function braceBody(text, openIdx) {
  let depth = 1;
  let i = openIdx + 1;
  for (; i < text.length && depth > 0; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
  }
  if (depth !== 0) throw new Error('Unclosed block in themes.ts');
  return text.slice(openIdx + 1, i - 1);
}

export function extractThemePair(themesTs, id) {
  const m = new RegExp(`id:\\s*'${id}'`).exec(themesTs);
  if (!m) throw new Error(`Theme '${id}' not found in themes.ts`);
  const open = themesTs.lastIndexOf('{', m.index);
  const body = braceBody(themesTs, open);
  const pair = {};
  for (const mode of ['light', 'dark']) {
    const mm = new RegExp(`\\b${mode}:\\s*(\\{|null)`).exec(body);
    if (!mm || mm[1] === 'null') throw new Error(`Theme '${id}' has no ${mode} mode`);
    const block = braceBody(body, mm.index + mm[0].length - 1);
    pair[mode] = {};
    for (const e of block.matchAll(/^\s*(?:'([\w-]+)'|([\w-]+))\s*:\s*'([^']*)'/gm)) pair[mode][e[1] ?? e[2]] = e[3];
  }
  return pair;
}

export const applyTheme = (base, pair) => ({
  light: { ...base.light, ...pair.light },
  dark: { ...base.dark, ...pair.dark },
});

const decls = (obj, indent) =>
  Object.entries(obj).map(([k, v]) => `${indent}--${k}: ${v};`).join('\n');

export function renderTokensCss({ light, dark }) {
  return `/* Generated from MinusPod frontend/src/index.css and themes.ts (${SITE_THEME} pair). Do not edit. */
:root {
${decls(light, '  ')}
}
:root[data-theme="dark"], .dark {
${decls(dark, '  ')}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${decls(dark, '    ')}
  }
}
`;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const css = readFileSync(`${mainDir()}/frontend/src/index.css`, 'utf8');
  const themes = readFileSync(`${mainDir()}/frontend/src/themes/themes.ts`, 'utf8');
  const outDir = resolve(root, 'shared/generated');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'tokens.css'), renderTokensCss(applyTheme(extractTokens(css), extractThemePair(themes, SITE_THEME))));
}
