import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { sitemapResponse } from '../../../shared/sitemap.mjs';

export const GET: APIRoute = async ({ site }) => sitemapResponse(site!, (await getCollection('docs')).map((d) => d.id));
