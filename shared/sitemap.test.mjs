import { expect, it } from 'vitest';
import { routePath, sitemapResponse, sitemapXml } from './sitemap.mjs';

it('writes one escaped loc per url', () => {
  const xml = sitemapXml([{ loc: 'https://minuspod.app/' }, { loc: 'https://minuspod.app/a&b/', lastmod: '2026-11-20' }]);
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')).toBe(true);
  expect(xml).toContain('<url><loc>https://minuspod.app/</loc></url>');
  expect(xml).toContain('<url><loc>https://minuspod.app/a&amp;b/</loc><lastmod>2026-11-20</lastmod></url>');
  expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
});

it('maps names to routes and answers with sorted absolute urls', async () => {
  expect(routePath('index')).toBe('/');
  expect(routePath('specs/demo')).toBe('/specs/demo/');
  const res = sitemapResponse(new URL('https://minuspod.app'), ['gallery', 'index'], { gallery: '2026-11-20' });
  expect(await res.text()).toContain('<loc>https://minuspod.app/</loc></url>\n  <url><loc>https://minuspod.app/gallery/</loc><lastmod>2026-11-20</lastmod>');
});
