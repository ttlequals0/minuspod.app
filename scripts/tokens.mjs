import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { isMain } from './lib/cli.mjs';
import { mainDir, repoRoot } from './lib/main-dir.mjs';

const SITE_THEME = 'nord';

function extractBlock(css, anchor) {
  const start = css.indexOf(anchor);
  if (start === -1) throw new Error(`Anchor "${anchor}" not found in index.css`);
  const body = braceBody(css, start + anchor.length - 1, anchor);
  const out = {};
  for (const m of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

export function extractTokens(css) {
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return { light: extractBlock(plain, ':root {'), dark: extractBlock(plain, '.dark {') };
}

function braceBody(text, openIdx, what) {
  let depth = 1;
  let i = openIdx + 1;
  for (; i < text.length && depth > 0; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
  }
  if (depth !== 0) throw new Error(`Unclosed block: ${what}`);
  return text.slice(openIdx + 1, i - 1);
}

export function extractThemePair(themesTs, id) {
  const m = new RegExp(`id:\\s*'${id}'`).exec(themesTs);
  if (!m) throw new Error(`Theme '${id}' not found in themes.ts`);
  const open = themesTs.lastIndexOf('{', m.index);
  const body = braceBody(themesTs, open, `theme '${id}'`);
  const pair = {};
  for (const mode of ['light', 'dark']) {
    const mm = new RegExp(`\\b${mode}:\\s*(\\{|null)`).exec(body);
    if (!mm || mm[1] === 'null') throw new Error(`Theme '${id}' has no ${mode} mode`);
    const block = braceBody(body, mm.index + mm[0].length - 1, `theme '${id}' ${mode}`);
    pair[mode] = {};
    for (const e of block.matchAll(/^\s*(?:'([\w-]+)'|(\w+))\s*:\s*'([^']*)'/gm)) pair[mode][e[1] ?? e[2]] = e[3];
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
:root[data-theme="dark"] {
${decls(dark, '  ')}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${decls(dark, '    ')}
  }
}
`;
}

if (isMain(import.meta.url)) {
  const main = mainDir();
  const css = readFileSync(`${main}/frontend/src/index.css`, 'utf8');
  const themes = readFileSync(`${main}/frontend/src/themes/themes.ts`, 'utf8');
  const outDir = resolve(repoRoot, 'shared/generated');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'tokens.css'), renderTokensCss(applyTheme(extractTokens(css), extractThemePair(themes, SITE_THEME))));
}
