// Agents ask for a page with Accept: text/markdown. Every HTML page has a Markdown twin built next
// to it (/ -> /index.md, /installation/ -> /installation.md); browsers never list text/markdown.
import { LINKS } from '../api-catalog.mjs';

export const MARKDOWN_TYPE = 'text/markdown; charset=utf-8';

export function acceptsMarkdown(accept) {
  let markdown = 0;
  let html = 0;
  for (const part of (accept || '').split(',')) {
    const [type, ...params] = part.split(';');
    const q = params.map((p) => /^\s*q=([\d.]+)\s*$/i.exec(p)).find(Boolean);
    const weight = q ? Number(q[1]) : 1;
    const t = type.trim().toLowerCase();
    if (t === 'text/markdown') markdown = Math.max(markdown, weight);
    else if (t === 'text/html') html = Math.max(html, weight);
  }
  return markdown > 0 && markdown >= html;
}

// page slugs may contain dots (/podcasting-2.0), so a missing twin is found by fetching, not by the name
export const markdownPath = (pathname) => `${pathname.replace(/\/+$/, '') || '/index'}.md`;

export async function negotiate(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  // a browser tab navigation always gets the page, whatever its Accept header says; agents fetch
  if (request.headers.get('Sec-Fetch-Dest') === 'document') return null;
  if (!acceptsMarkdown(request.headers.get('Accept'))) return null;
  const url = new URL(request.url);
  url.pathname = markdownPath(url.pathname);
  const res = await env.ASSETS.fetch(new Request(url, request));
  if (res.status !== 200 && res.status !== 304) {
    await res.body?.cancel();
    return null;
  }
  const out = new Response(res.body, res);
  out.headers.set('Content-Type', MARKDOWN_TYPE);
  out.headers.append('Vary', 'Accept');
  return out;
}

// HTML pages name the discovery resources and their twin. Vary: Accept only goes on answers to
// requests that mentioned text/markdown; browser responses stay reusable by the prefetch cache.
export function pageHeaders(res, pathname, accept) {
  if (res.status !== 200 || !(res.headers.get('Content-Type') || '').startsWith('text/html')) return res;
  const out = new Response(res.body, res);
  if (/text\/markdown/i.test(accept || '')) out.headers.append('Vary', 'Accept');
  out.headers.set('Link', [...LINKS, `<${markdownPath(pathname)}>; rel="alternate"; type="text/markdown"`].join(', '));
  return out;
}
