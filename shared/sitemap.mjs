// one <url> per page; both sites list pages only, so no lastmod or priority
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// a page's route from its file or collection id: index is the root, everything else gets a trailing slash
export const routePath = (name) => (name === 'index' ? '/' : `/${name}/`);

export const sitemapXml = (urls) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${escape(u)}</loc></url>`)
    .join('\n')}\n</urlset>\n`;

// Astro static endpoint body; the content type comes from the .xml extension at serve time
export const sitemapResponse = (site, names) => new Response(sitemapXml(names.map((n) => new URL(routePath(n), site).href).sort()));
