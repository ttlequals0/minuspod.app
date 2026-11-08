import { expect, it } from 'vitest';
import { routePath, sitemapResponse, sitemapXml } from './sitemap.mjs';

it('writes one escaped loc per url', () => {
  const xml = sitemapXml(['https://minuspod.app/', 'https://minuspod.app/a&b/']);
  expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')).toBe(true);
  expect(xml).toContain('<url><loc>https://minuspod.app/</loc></url>');
  expect(xml).toContain('<loc>https://minuspod.app/a&amp;b/</loc>');
  expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
});

it('maps names to routes and answers with sorted absolute urls', async () => {
  expect(routePath('index')).toBe('/');
  expect(routePath('specs/demo')).toBe('/specs/demo/');
  const res = sitemapResponse(new URL('https://minuspod.app'), ['gallery', 'index']);
  expect(await res.text()).toContain('<loc>https://minuspod.app/</loc></url>\n  <url><loc>https://minuspod.app/gallery/</loc>');
});
