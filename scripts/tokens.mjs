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
  // Vite-only env object; any read becomes undefined under plain Node
  const src = readFileSync(srcPath, 'utf8').replaceAll('import.meta.env', '({})');
  writeFileSync(scratchPath, src);
  return import(pathToFileURL(scratchPath).href);
}

const pickKeys = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));

// only THEME_VAR_KEYS per pair; a missing mode falls back to the base (Slate) values, as in the app
export const pairVars = (base, pair, keys) => ({
  light: { ...pickKeys(base.light, keys), ...pickKeys(pair.light, keys) },
  dark: { ...pickKeys(base.dark, keys), ...pickKeys(pair.dark, keys) },
});

const decls = (obj, indent) =>
  Object.entries(obj).map(([k, v]) => `${indent}--${k}: ${v};`).join('\n');

export function renderTokensCss({ base, themes, defaultPair, keys }) {
  for (const t of themes) {
    if (!/^[a-z0-9-]+$/.test(t.id)) throw new Error(`Invalid theme id '${t.id}' in themes.ts`);
  }
  const def = themes.find((t) => t.id === defaultPair);
  if (!def) throw new Error(`Default pair '${defaultPair}' not found in themes.ts`);
  const light = { ...base.light, ...pickKeys(def.light, keys) };
  const dark = { ...base.dark, ...pickKeys(def.dark, keys) };
  // :root already carries the default pair, so it gets no block of its own
  const blocks = themes.filter((t) => t.id !== defaultPair).map((t) => {
    const v = pairVars(base, t, keys);
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
  color-scheme: light;
${decls(light, '  ')}
}
:root[data-theme="dark"] {
  color-scheme: dark;
${decls(dark, '  ')}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
${decls(dark, '    ')}
  }
}
${blocks.join('')}`;
}

export function renderThemesJson({ THEMES, THEME_GROUPS }) {
  const themes = THEME_GROUPS.flatMap((group) =>
    THEMES.filter((t) => t.group === group).map((t) => {
      // both null means the base values apply in both modes
      const neither = t.light === null && t.dark === null;
      return {
        id: t.id,
        label: t.label,
        group: t.group,
        accentColor: t.accentColor,
        light: neither || t.light !== null,
        dark: neither || t.dark !== null,
      };
    }),
  );
  return `${JSON.stringify({ groups: THEME_GROUPS, themes }, null, 2)}\n`;
}

if (isMain(import.meta.url)) {
  const main = mainDir();
  const css = readFileSync(`${main}/frontend/src/index.css`, 'utf8');
  const outDir = resolve(repoRoot, 'shared/generated');
  mkdirSync(outDir, { recursive: true });
  const themes = await loadThemes(`${main}/frontend/src/themes/themes.ts`, resolve(outDir, 'themes.import.ts'));
  writeFileSync(resolve(outDir, 'tokens.css'), renderTokensCss({ base: extractTokens(css), themes: themes.THEMES, defaultPair: DEFAULT_PAIR, keys: themes.THEME_VAR_KEYS }));
  writeFileSync(resolve(outDir, 'themes.json'), renderThemesJson(themes));
}
