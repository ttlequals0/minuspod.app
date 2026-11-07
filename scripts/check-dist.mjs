import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const SKIP = /^([a-z][a-z0-9+.-]*:|\/\/)/i;
const ATTR_RE = /\b(href|src|srcset|poster)="([^"]*)"/g;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'pagefind' ? [] : walk(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

const isFile = (p) => existsSync(p) && statSync(p).isFile();
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

const idCache = new Map();
function idsOf(file) {
  if (!idCache.has(file)) {
    const ids = new Set();
    for (const m of readFileSync(file, 'utf8').matchAll(/\bid="([^"]*)"/g)) ids.add(m[1]);
    idCache.set(file, ids);
  }
  return idCache.get(file);
}

function values(attr, raw) {
  const v = decode(raw).trim();
  if (attr !== 'srcset') return [v];
  return v.split(',').map((c) => c.trim().split(/\s+/)[0]).filter(Boolean);
}

function resolveTarget(distDir, pageFile, urlPath) {
  const base = urlPath.startsWith('/') ? join(distDir, urlPath) : resolve(dirname(pageFile), urlPath);
  return [base, join(base, 'index.html'), `${base}.html`].find(isFile);
}

function check(distDir) {
  const root = resolve(distDir);
  const problems = [];
  for (const page of walk(root)) {
    const html = readFileSync(page, 'utf8');
    for (const [, attr, raw] of html.matchAll(ATTR_RE)) {
      for (const value of values(attr, raw)) {
        if (!value || SKIP.test(value)) continue;
        if (/^#/.test(value) && value.length === 1) continue;
        const hash = value.indexOf('#');
        const urlPath = (hash === -1 ? value : value.slice(0, hash)).replace(/\?.*$/, '');
        let fragment = hash === -1 ? '' : value.slice(hash + 1);
        let ok = true;
        try {
          fragment = decodeURIComponent(fragment);
        } catch {
          ok = false;
        }
        const target = urlPath ? resolveTarget(root, page, urlPath) : page;
        ok = ok && Boolean(target);
        if (ok && fragment) ok = target.endsWith('.html') && idsOf(target).has(fragment);
        if (!ok) problems.push(`${relative(process.cwd(), page)}: ${attr}="${value}"`);
      }
    }
  }
  return problems;
}

const dirs = process.argv.slice(2);
if (!dirs.length) {
  console.error('usage: node scripts/check-dist.mjs <distDir>...');
  process.exit(2);
}
const problems = dirs.flatMap(check);
for (const p of problems) console.log(p);
console.log(`${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
