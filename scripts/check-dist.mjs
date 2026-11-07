import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { isMain } from './lib/cli.mjs';
import { ATTR_RE, isExternalHref, srcsetUrls } from './lib/md.mjs';

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'pagefind' ? [] : walk(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

const fileCache = new Map();
function isFile(p) {
  if (!fileCache.has(p)) fileCache.set(p, existsSync(p) && statSync(p).isFile());
  return fileCache.get(p);
}

const safeDecode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
};
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export const idsIn = (html) => new Set([...html.matchAll(/(?:^|\s)id="([^"]*)"/g)].map((m) => m[1]));

const idCache = new Map();
function idsOf(file) {
  if (!idCache.has(file)) idCache.set(file, idsIn(readFileSync(file, 'utf8')));
  return idCache.get(file);
}

function values(attr, raw) {
  const v = decode(raw).trim();
  if (attr !== 'srcset') return [v];
  return srcsetUrls(v);
}

function resolveTarget(distDir, pageFile, urlPath) {
  const base = urlPath.startsWith('/') ? join(distDir, urlPath) : resolve(dirname(pageFile), urlPath);
  return [base, join(base, 'index.html'), `${base.replace(/\/$/, '')}.html`].find(isFile);
}

// Returns [distDir, local path] for a root-relative, relative or mapped-host URL, or null to skip it.
function locate(value, root, hosts) {
  for (const [origin, dir] of hosts) {
    if (value === origin || value.startsWith(`${origin}/`) || value.startsWith(`${origin}#`)) {
      const rest = value.slice(origin.length);
      return [resolve(dir), rest.startsWith('#') ? `/${rest}` : rest || '/'];
    }
  }
  return isExternalHref(value) ? null : [root, value];
}

const META_IMAGE = /<meta\b[^>]*>/g;
const META_IMAGE_KEY = /\b(?:property="og:image"|name="twitter:image")/;

function* references(html) {
  for (const [, attr, raw] of html.matchAll(ATTR_RE)) yield [attr, raw];
  for (const [tag] of html.matchAll(META_IMAGE)) {
    const content = META_IMAGE_KEY.test(tag) && /\bcontent="([^"]*)"/.exec(tag);
    if (content) yield ['content', content[1]];
  }
}

export function check(distDir, hosts = new Map()) {
  const root = resolve(distDir);
  const problems = [];
  for (const page of walk(root)) {
    const html = readFileSync(page, 'utf8');
    for (const [attr, raw] of references(html)) {
      for (const value of values(attr, raw)) {
        if (!value || value === '#') continue;
        const located = locate(value, root, hosts);
        if (!located) continue;
        const [dir, local] = located;
        const hash = local.indexOf('#');
        const urlPath = (hash === -1 ? local : local.slice(0, hash)).replace(/\?.*$/, '');
        const fragment = safeDecode(hash === -1 ? '' : local.slice(hash + 1));
        const target = urlPath ? resolveTarget(dir, page, urlPath) : page;
        const ok = fragment !== null && target && (!fragment || (target.endsWith('.html') && idsOf(target).has(fragment)));
        if (!ok) problems.push(`${relative(process.cwd(), page)}: ${attr}="${value}"`);
      }
    }
  }
  return problems;
}

export function collectSlugs(items) {
  return items.flatMap((item) => {
    if (typeof item === 'string') return [item];
    if (item.items) return collectSlugs(item.items);
    return [item.slug ?? item.autogenerate?.directory].filter(Boolean);
  });
}

export function sidebarProblems(slugs, distDir) {
  const root = resolve(distDir);
  if (!existsSync(root)) return [`sidebar: ${distDir} missing`];
  const listed = new Set(slugs);
  const pages = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && isFile(join(root, e.name, 'index.html')))
    .map((e) => e.name)
    .sort();
  return [
    ...slugs.filter((slug) => !isFile(join(root, slug, 'index.html'))).map((slug) => `sidebar: ${slug}`),
    ...pages.filter((p) => !listed.has(p)).map((p) => `sidebar missing: ${p}`),
  ];
}

async function main() {
  const { positionals, values: opts } = parseArgs({
    allowPositionals: true,
    options: { sidebar: { type: 'string' }, host: { type: 'string', multiple: true } },
  });
  const hosts = new Map();
  let bad = false;
  for (const h of opts.host ?? []) {
    const [origin, dir] = h.split('=');
    if (origin && dir) hosts.set(origin.replace(/\/$/, ''), dir);
    else bad = true;
  }
  if (!positionals.length || bad) {
    console.error('usage: node scripts/check-dist.mjs <distDir>... [--sidebar <astro.config.mjs>] [--host <origin>=<distDir>]...');
    process.exit(2);
  }
  const dirs = positionals.filter((d) => {
    if (existsSync(d)) return true;
    console.log(`skipping missing dist dir: ${d}`);
    return false;
  });
  if (!dirs.length) {
    console.log('no dist dir found');
    process.exit(1);
  }
  const problems = dirs.flatMap((d) => check(d, hosts));
  if (opts.sidebar) {
    const { SIDEBAR } = await import(pathToFileURL(resolve(opts.sidebar)).href);
    problems.push(...sidebarProblems(collectSlugs(SIDEBAR), positionals[0]));
  }
  for (const p of problems) console.log(p);
  console.log(`${problems.length} problems`);
  process.exit(problems.length ? 1 : 0);
}

if (isMain(import.meta.url)) {
  await main();
}
