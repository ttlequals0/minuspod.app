// Tells IndexNow (Bing and the engines that share it) which pages a deploy changed.
// `plan` runs before the deploy and compares the built sitemaps with the live ones; `send` runs after it.
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isMain } from './lib/cli.mjs';
import { repoRoot } from './lib/main-dir.mjs';
import { DOCS_SITE, LANDING_SITE } from '../shared/social.mjs';

// public by design: each site serves it at /<key>.txt to prove the submitter owns the host
export const INDEXNOW_KEY = '7f82afec02131148a92920b4840aec18';
const SITES = [
  { origin: LANDING_SITE, dist: 'landing/dist' },
  { origin: DOCS_SITE, dist: 'docs/dist' },
];
const PLAN = join(tmpdir(), 'minuspod-indexnow.json');

// loc -> lastmod ('' when the page has none)
export const sitemapEntries = (xml) =>
  new Map([...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)].map((m) => [m[1], m[2] ?? '']));

// pages that are new or whose lastmod differs from the live sitemap
export const changedUrls = (live, built) => [...built].filter(([loc, lastmod]) => live.get(loc) !== lastmod).map(([loc]) => loc);

if (isMain(import.meta.url)) {
  if (process.argv[2] === 'plan') {
    const plan = [];
    for (const { origin, dist } of SITES) {
      const res = await fetch(`${origin}/sitemap.xml`);
      if (!res.ok) throw new Error(`indexnow: ${origin}/sitemap.xml answered ${res.status}`);
      const urlList = changedUrls(sitemapEntries(await res.text()), sitemapEntries(readFileSync(join(repoRoot, dist, 'sitemap.xml'), 'utf8')));
      console.log(`indexnow: ${urlList.length} changed pages on ${origin}`);
      if (urlList.length) plan.push({ host: new URL(origin).host, key: INDEXNOW_KEY, keyLocation: `${origin}/${INDEXNOW_KEY}.txt`, urlList });
    }
    writeFileSync(PLAN, JSON.stringify(plan));
  } else {
    for (const body of JSON.parse(readFileSync(PLAN, 'utf8'))) {
      const res = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
      console.log(`indexnow: ${body.host} ${res.status}`);
      if (!res.ok) process.exitCode = 1;
    }
  }
}
