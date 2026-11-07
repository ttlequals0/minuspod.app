import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_PAIR } from '../shared/theme/config.mjs';
import { isMain } from './lib/cli.mjs';
import { mainDir, repoRoot } from './lib/main-dir.mjs';

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

export async function loadThemes(srcPath, scratchPath) {
  const src = readFileSync(srcPath, 'utf8').replaceAll('import.meta.env.DEV', 'false');
  mkdirSync(resolve(scratchPath, '..'), { recursive: true });
  writeFileSync(scratchPath, src);
  return import(pathToFileURL(scratchPath).href);
}

export const pairVars = (base, pair) => ({
  light: { ...base.light, ...(pair.light ?? {}) },
  dark: { ...base.dark, ...(pair.dark ?? {}) },
});

const decls = (obj, indent) =>
  Object.entries(obj).map(([k, v]) => `${indent}--${k}: ${v};`).join('\n');

export function renderTokensCss({ base, themes, defaultPair }) {
  const def = themes.find((t) => t.id === defaultPair);
  if (!def) throw new Error(`Default pair '${defaultPair}' not found in themes.ts`);
  const { light, dark } = pairVars(base, def);
  const blocks = themes.map((t) => {
    const v = pairVars(base, t);
    return `:root[data-pair="${t.id}"] {
${decls(v.light, '  ')}
}
:root[data-pair="${t.id}"][data-theme="dark"] {
${decls(v.dark, '  ')}
}
`;
  });
  return `/* Generated from MinusPod frontend/src/index.css and themes.ts. Do not edit. */
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
${blocks.join('')}`;
}

export function renderThemesJson({ THEMES, THEME_GROUPS }, defaultPair) {
  const themes = THEME_GROUPS.flatMap((group) =>
    THEMES.filter((t) => t.group === group).map((t) => ({
      id: t.id,
      label: t.label,
      group: t.group,
      accentColor: t.accentColor,
      light: t.light !== null,
      dark: t.dark !== null,
    })),
  );
  return `${JSON.stringify({ defaultPair, groups: THEME_GROUPS, themes }, null, 2)}\n`;
}

if (isMain(import.meta.url)) {
  const main = mainDir();
  const css = readFileSync(`${main}/frontend/src/index.css`, 'utf8');
  const outDir = resolve(repoRoot, 'shared/generated');
  mkdirSync(outDir, { recursive: true });
  const themes = await loadThemes(`${main}/frontend/src/themes/themes.ts`, resolve(outDir, 'themes.import.ts'));
  writeFileSync(resolve(outDir, 'tokens.css'), renderTokensCss({ base: extractTokens(css), themes: themes.THEMES, defaultPair: DEFAULT_PAIR }));
  writeFileSync(resolve(outDir, 'themes.json'), renderThemesJson(themes, DEFAULT_PAIR));
}
