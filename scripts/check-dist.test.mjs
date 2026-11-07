import { test, expect } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { check, collectSlugs, idsIn, sidebarProblems } from './check-dist.mjs';

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
  expect(collectSlugs(sidebar)).toEqual(['top', 'a', 'b', 'c']);
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
    'pagefind/index.html': '',
    '_astro/index.html': '',
    'images/a.svg': '',
  });
  expect(sidebarProblems(['a', 'gone'], dist)).toEqual(['sidebar: gone', 'sidebar missing: orphan']);
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

test('check resolves a trailing-slash URL to a flat html file', () => {
  const docs = tree({ '404.html': '<link rel="canonical" href="https://docs.minuspod.app/404/">' });
  expect(check(docs, new Map([['https://docs.minuspod.app', docs]]))).toEqual([]);
});
