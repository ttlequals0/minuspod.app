import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SKIP = /^([a-z][a-z0-9+.-]*:|\/\/)/i;
const ATTR_RE = /\b(href|src|srcset|poster)="([^"]*)"/g;
const NOT_IN_SIDEBAR = new Set(['specs', '404', 'pagefind', '_astro']);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'pagefind' ? [] : walk(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

const isFile = (p) => existsSync(p) && statSync(p).isFile();
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
  return v.split(',').map((c) => c.trim().split(/\s+/)[0]).filter(Boolean);
}

function resolveTarget(distDir, pageFile, urlPath) {
  const base = urlPath.startsWith('/') ? join(distDir, urlPath) : resolve(dirname(pageFile), urlPath);
  return [base, join(base, 'index.html'), `${base.replace(/\/$/, '')}.html`].find(isFile);
}

// Returns [distDir, local path] for a root-relative, relative or mapped-host URL, or null to skip it.
function locate(value, root, hosts) {
  for (const [origin, dir] of hosts) {
    if (value === origin || value.startsWith(`${origin}/`) || value.startsWith(`${origin}#`)) {
      return [resolve(dir), value.slice(origin.length) || '/'];
    }
  }
  return SKIP.test(value) ? null : [root, value];
}

export function check(distDir, hosts = new Map()) {
  const root = resolve(distDir);
  const problems = [];
  for (const page of walk(root)) {
    const html = readFileSync(page, 'utf8');
    for (const [, attr, raw] of html.matchAll(ATTR_RE)) {
      for (const value of values(attr, raw)) {
        if (!value || value === '#') continue;
        const located = locate(value, root, hosts);
        if (!located) continue;
        const [dir, local] = located;
        const hash = local.indexOf('#');
        const urlPath = (hash === -1 ? local : local.slice(0, hash)).replace(/\?.*$/, '');
        let fragment = hash === -1 ? '' : local.slice(hash + 1);
        let ok = true;
        try {
          fragment = decodeURIComponent(fragment);
        } catch {
          ok = false;
        }
        const target = urlPath ? resolveTarget(dir, page, urlPath) : page;
        ok = ok && Boolean(target);
        if (ok && fragment) ok = target.endsWith('.html') && idsOf(target).has(fragment);
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
    return item.slug ? [item.slug] : [];
  });
}

export function sidebarProblems(slugs, distDir) {
  const root = resolve(distDir);
  const listed = new Set(slugs);
  const pages = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !NOT_IN_SIDEBAR.has(e.name) && isFile(join(root, e.name, 'index.html')))
    .map((e) => e.name)
    .sort();
  return [
    ...slugs.filter((slug) => !isFile(join(root, slug, 'index.html'))).map((slug) => `sidebar: ${slug}`),
    ...pages.filter((p) => !listed.has(p)).map((p) => `sidebar missing: ${p}`),
  ];
}

async function main() {
  const args = process.argv.slice(2);
  const hosts = new Map();
  let sidebarPath = null;
  let bad = false;
  const dirArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--sidebar') {
      sidebarPath = args[++i];
      bad ||= !sidebarPath;
    } else if (args[i] === '--host') {
      const [origin, dir] = (args[++i] ?? '').split('=');
      if (origin && dir) hosts.set(origin.replace(/\/$/, ''), dir);
      else bad = true;
    } else dirArgs.push(args[i]);
  }
  if (!dirArgs.length || bad) {
    console.error('usage: node scripts/check-dist.mjs <distDir>... [--sidebar <astro.config.mjs>] [--host <origin>=<distDir>]...');
    process.exit(2);
  }
  const dirs = dirArgs.filter((d) => {
    if (existsSync(d)) return true;
    console.log(`skipping missing dist dir: ${d}`);
    return false;
  });
  if (!dirs.length) {
    console.log('no dist dir found');
    process.exit(1);
  }
  const problems = dirs.flatMap((d) => check(d, hosts));
  if (sidebarPath) {
    const { SIDEBAR } = await import(pathToFileURL(resolve(sidebarPath)).href);
    problems.push(...(existsSync(dirArgs[0]) ? sidebarProblems(collectSlugs(SIDEBAR), dirArgs[0]) : [`sidebar: ${dirArgs[0]} missing`]));
  }
  for (const p of problems) console.log(p);
  console.log(`${problems.length} problems`);
  process.exit(problems.length ? 1 : 0);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
