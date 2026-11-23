import { expect, test } from 'vitest';
import { changedUrls, sitemapEntries } from './indexnow.mjs';
import { sitemapXml } from '../shared/sitemap.mjs';

const entries = (pages) => sitemapEntries(sitemapXml(pages));

test('changedUrls lists new pages and pages with another lastmod', () => {
  const live = entries([{ loc: 'https://a/' }, { loc: 'https://a/same/', lastmod: '2026-11-08' }, { loc: 'https://a/edited/', lastmod: '2026-11-08' }, { loc: 'https://a/gone/' }]);
  const built = entries([{ loc: 'https://a/' }, { loc: 'https://a/same/', lastmod: '2026-11-08' }, { loc: 'https://a/edited/', lastmod: '2026-11-20' }, { loc: 'https://a/new/' }]);
  expect(changedUrls(live, built)).toEqual(['https://a/edited/', 'https://a/new/']);
});
