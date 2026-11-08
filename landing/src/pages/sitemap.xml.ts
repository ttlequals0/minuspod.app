import type { APIRoute } from 'astro';
import { sitemapResponse } from '../../../shared/sitemap.mjs';

const pages = Object.keys(import.meta.glob('./**/*.astro'))
  .map((p) => p.replace(/^\.\//, '').replace(/\.astro$/, ''))
  .filter((p) => p !== '404');

export const GET: APIRoute = ({ site }) => sitemapResponse(site!, pages);
