import type { APIRoute } from 'astro';
import { sitemapResponse } from '../../../shared/sitemap.mjs';

type Page = { getStaticPaths: () => { params: Record<string, string> }[] };

const files = import.meta.glob<Page>('./**/*.astro');

export const GET: APIRoute = async ({ site }) => {
  const pages = await Promise.all(
    Object.entries(files).map(async ([file, load]) => {
      const name = file.replace(/^\.\//, '').replace(/\.astro$/, '');
      if (name === '404') return [];
      if (!name.includes('[')) return [name];
      // a dynamic route lists one page for each path it builds
      const { getStaticPaths } = await load();
      return getStaticPaths().map(({ params }) => name.replace(/\[(?:\.\.\.)?(\w+)\]/g, (m, key) => params[key]));
    }),
  );
  return sitemapResponse(site!, pages.flat());
};
