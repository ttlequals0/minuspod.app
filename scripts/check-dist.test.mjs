import { test, expect } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { agentProblems, check, collectSlugs, idsIn, pagePath, sidebarProblems, workerFirstProblems } from './check-dist.mjs';

function tree(files) {
  const root = mkdtempSync(join(tmpdir(), 'dist-'));
  for (const [p, body] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), body);
  }
  return root;
}

test('collectSlugs returns only page slugs', () => {
  const sidebar = [
    'top',
    {
      label: 'Group',
      items: [
        'a',
        { slug: 'b' },
        { label: 'Ext', link: 'https://example.com/' },
        { label: 'Auto', autogenerate: { directory: 'specs' } },
        { label: 'Nested', items: ['c'] },
      ],
    },
  ];
  expect(collectSlugs(sidebar)).toEqual(['top', 'a', 'b', 'specs', 'c']);
});

test('idsIn ignores data-id attributes', () => {
  expect([...idsIn('<h2 id="real">x</h2><div data-id="fake"></div><p\tid="tab">')]).toEqual(['real', 'tab']);
});

test('sidebarProblems reports both missing pages and pages without an entry', () => {
  const dist = tree({
    'index.html': '',
    '404.html': '',
    'a/index.html': '',
    'orphan/index.html': '',
    'specs/index.html': '',
    'specs/x/index.html': '',
    'pagefind/pagefind.js': '',
    '_astro/a.css': '',
    'images/a.svg': '',
  });
  expect(sidebarProblems(['a', 'gone', 'specs'], dist)).toEqual(['sidebar: gone', 'sidebar missing: orphan']);
});

test('check resolves mapped cross-host URLs against their dist dir', () => {
  const landing = tree({ 'videos/a.mp4': '', 'index.html': '<h2 id="top">x</h2>' });
  const docs = tree({
    'index.html': [
      '<video poster="https://minuspod.app/videos/a.mp4" src="https://minuspod.app/videos/missing.mp4"></video>',
      '<a href="https://minuspod.app/#top">ok</a>',
      '<a href="https://minuspod.app/#nope">bad</a>',
      '<a href="https://example.com/x">external</a>',
    ].join('\n'),
  });
  const problems = check(docs, new Map([['https://minuspod.app', landing]]));
  expect(problems).toHaveLength(2);
  expect(problems[0]).toMatch(/src="https:\/\/minuspod\.app\/videos\/missing\.mp4"$/);
  expect(problems[1]).toMatch(/href="https:\/\/minuspod\.app\/#nope"$/);
});

test('check resolves a bare-fragment link on another host against that host index', () => {
  const landing = tree({ 'index.html': '<h2 id="top">x</h2>' });
  const docs = tree({
    'index.html': '<h2 id="local">x</h2><a href="https://minuspod.app#top">ok</a><a href="https://minuspod.app#local">bad</a>',
  });
  const problems = check(docs, new Map([['https://minuspod.app', landing]]));
  expect(problems).toHaveLength(1);
  expect(problems[0]).toMatch(/href="https:\/\/minuspod\.app#local"$/);
});

test('check validates og:image and twitter:image content', () => {
  const dist = tree({
    'a.png': '',
    'index.html': [
      '<meta property="og:image" content="/a.png">',
      '<meta name="twitter:image" content="/missing.png">',
      '<meta property="og:title" content="/not-a-file">',
    ].join('\n'),
  });
  const problems = check(dist);
  expect(problems).toHaveLength(1);
  expect(problems[0]).toMatch(/content="\/missing\.png"$/);
});

test('sidebarProblems reports a missing dist dir', () => {
  expect(sidebarProblems(['a'], '/nonexistent-dist-dir')).toEqual(['sidebar: /nonexistent-dist-dir missing']);
});

test('check resolves a trailing-slash URL to a flat html file', () => {
  const docs = tree({ '404.html': '<link rel="canonical" href="https://docs.minuspod.app/404/">' });
  expect(check(docs, new Map([['https://docs.minuspod.app', docs]]))).toEqual([]);
});

test('pagePath maps built files to the URL they answer to', () => {
  expect(pagePath('/d', '/d/index.html')).toBe('/');
  expect(pagePath('/d', '/d/gallery/index.html')).toBe('/gallery/');
  expect(pagePath('/d', '/d/specs/demo/index.html')).toBe('/specs/demo/');
  expect(pagePath('/d', '/d/flat.html')).toBe('/flat/');
});

const CATALOG = JSON.stringify({
  linkset: [{ anchor: 'https://docs.example/api/', 'service-desc': [{ href: 'https://docs.example/openapi.yaml' }], 'service-doc': [{ href: 'https://docs.example/api/' }] }],
});
const HEADERS = '/.well-known/api-catalog\n  Content-Type: application/linkset+json\n';
const SITEMAP = '<urlset><url><loc>https://site.example/</loc></url><url><loc>https://site.example/gallery/</loc></url></urlset>';
const WRANGLER = '{\n  // comment with a "quote" and https://x.example/\n  "assets": { "run_worker_first": ["/*", "!/_astro/*", "!/*.txt", "!/videos/*.jpg"] }\n}\n';
// the dist sits next to its wrangler.jsonc, as in the repo
const site = (extra = {}) =>
  join(
    tree(
      Object.fromEntries(
        Object.entries({
          'dist/index.html': '',
          'dist/gallery/index.html': '',
          'dist/404.html': '',
          'dist/index.md': '',
          'dist/gallery.md': '',
          'dist/robots.txt': 'User-agent: *\nContent-Signal: search=yes\n\nSitemap: https://site.example/sitemap.xml\n',
          'dist/sitemap.xml': SITEMAP,
          'dist/.well-known/api-catalog': CATALOG,
          'dist/_headers': HEADERS,
          'dist/_astro/a.css': '',
          'dist/videos/a.jpg': '',
          'wrangler.jsonc': WRANGLER,
          ...extra,
        }).filter(([, body]) => body !== null),
      ),
    ),
    'dist',
  );
const docsDist = tree({ 'index.html': '', 'api/index.html': '', 'openapi.yaml': '' });
const hosts = new Map([['https://docs.example', docsDist]]);

test('agentProblems is clean for a complete site', () => {
  expect(agentProblems(site(), 'https://site.example', hosts)).toEqual([]);
  expect(agentProblems(site({ 'dist/sitemap-0.xml': SITEMAP }), 'https://site.example', hosts)).toEqual([]);
});

test('agentProblems reports each missing piece', () => {
  const dist = site({
    'dist/extra/index.html': '',
    'dist/robots.txt': 'User-agent: *\n',
    'dist/sitemap.xml': '<urlset><url><loc>https://site.example/</loc></url><url><loc>https://site.example/gone/</loc></url></urlset>',
    'dist/sitemap-0.xml': SITEMAP,
    'dist/.well-known/api-catalog': JSON.stringify({ linkset: [{ anchor: 'https://docs.example/nope/', 'service-doc': [{ href: '/x' }] }] }),
    'dist/_headers': '/*\n  X: y\n',
    'dist/videos/a.jpg': null,
  });
  expect(agentProblems(dist, 'https://site.example', hosts).sort()).toEqual([
    'agent: _headers lacks the api-catalog Content-Type',
    'agent: api-catalog entry lacks service-desc',
    'agent: api-catalog href /x',
    'agent: api-catalog href https://docs.example/nope/',
    'agent: no markdown twin for /extra/',
    'agent: robots.txt lacks Content-Signal',
    'agent: robots.txt lacks the Sitemap line',
    'agent: run_worker_first excludes nothing with !/videos/*.jpg',
    'agent: sitemap-0.xml and sitemap.xml differ on https://site.example/gallery/',
    'agent: sitemap-0.xml and sitemap.xml differ on https://site.example/gone/',
    'agent: sitemap.xml lists https://site.example/gone/',
    'agent: sitemap.xml missing /extra/',
    'agent: sitemap.xml missing /gallery/',
  ]);
});

test('agentProblems reports a missing dist and an empty linkset', () => {
  expect(agentProblems('/nonexistent-dist-dir', 'https://site.example')).toEqual(['agent: /nonexistent-dist-dir missing']);
  expect(agentProblems(site({ 'dist/.well-known/api-catalog': '{"linkset":[]}' }), 'https://site.example', hosts)).toEqual(['agent: api-catalog linkset is empty']);
});

test('workerFirstProblems flags exclusions that match nothing in the dist', () => {
  const dist = tree({ 'index.html': '', 'robots.txt': '', 'images/a.svg': '', 'flat.txt': '' });
  const config = join(dist, 'w.jsonc');
  writeFileSync(config, '{ "assets": { "run_worker_first": ["/*", "!/images/*", "!/*.txt", "!/brand/*", "!/*.xml", "!/images/*.png", "!/odd"] } }');
  expect(workerFirstProblems(dist, config)).toEqual([
    'agent: run_worker_first excludes nothing with !/brand/*',
    'agent: run_worker_first excludes nothing with !/*.xml',
    'agent: run_worker_first excludes nothing with !/images/*.png',
  ]);
});
