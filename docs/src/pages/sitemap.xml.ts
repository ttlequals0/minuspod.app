import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { sitemapResponse } from '../../../shared/sitemap.mjs';

export const GET: APIRoute = async ({ site }) => {
  const docs = await getCollection('docs');
  // prepare-docs dates a page by the last commit of its source file
  const day = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : undefined);
  return sitemapResponse(site!, docs.map((d) => d.id), Object.fromEntries(docs.map((d) => [d.id, day(d.data.lastUpdated)])));
};
