import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mainDir } from './lib/main-dir.mjs';

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

const decls = (obj, indent) =>
  Object.entries(obj).map(([k, v]) => `${indent}--${k}: ${v};`).join('\n');

export function renderTokensCss({ light, dark }) {
  return `/* Generated from MinusPod frontend/src/index.css. Do not edit. */
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
  const outDir = resolve(root, 'shared/generated');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'tokens.css'), renderTokensCss(extractTokens(css)));
}
