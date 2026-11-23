// one <url> per page, with a lastmod where the build knows when the page's source last changed
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// a page's route from its file or collection id: index is the root, everything else gets a trailing slash
export const routePath = (name) => (name === 'index' ? '/' : `/${name}/`);

export const sitemapXml = (pages) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map(({ loc, lastmod }) => `  <url><loc>${escape(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`)
    .join('\n')}\n</urlset>\n`;

// Astro static endpoint body; the content type comes from the .xml extension at serve time
export const sitemapResponse = (site, names, lastmod = {}) =>
  new Response(sitemapXml(names.map((n) => ({ loc: new URL(routePath(n), site).href, lastmod: lastmod[n] })).sort((a, b) => (a.loc < b.loc ? -1 : 1))));
