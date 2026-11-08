import { describe, expect, it } from 'vitest';
import { acceptsMarkdown, markdownPath, negotiate, pageHeaders } from './agent.mjs';

const assets = (files) => ({
  seen: [],
  async fetch(req) {
    this.seen.push(req);
    const path = new URL(req.url).pathname;
    if (!(path in files)) return new Response('missing', { status: 404 });
    return new Response(files[path], { status: 200, headers: { 'Content-Type': 'text/markdown', ETag: '"md"' } });
  },
});
const env = { ASSETS: assets({ '/index.md': '# Home', '/gallery.md': '# Gallery' }) };
const req = (path, accept, method = 'GET') => new Request(`https://minuspod.app${path}`, { method, headers: accept ? { Accept: accept } : {} });
const html = (status = 200, headers = {}) => new Response('<p>', { status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers } });

describe('acceptsMarkdown', () => {
  it('is true when text/markdown is listed at least as high as text/html', () => {
    expect(acceptsMarkdown('text/markdown')).toBe(true);
    expect(acceptsMarkdown('text/markdown, text/html;q=0.9')).toBe(true);
    expect(acceptsMarkdown('text/html, text/markdown')).toBe(true);
    expect(acceptsMarkdown('TEXT/MARKDOWN ; q=0.5')).toBe(true);
  });
  it('is false for browsers, wildcards, q=0 and a lower rank than html', () => {
    expect(acceptsMarkdown('text/html,application/xhtml+xml,*/*;q=0.8')).toBe(false);
    expect(acceptsMarkdown('*/*')).toBe(false);
    expect(acceptsMarkdown(null)).toBe(false);
    expect(acceptsMarkdown('text/markdown;q=0')).toBe(false);
    expect(acceptsMarkdown('text/html, text/markdown;q=0.5')).toBe(false);
  });
});

describe('markdownPath', () => {
  it('maps page paths, dotted slugs included, to their .md twin', () => {
    expect(markdownPath('/')).toBe('/index.md');
    expect(markdownPath('/gallery/')).toBe('/gallery.md');
    expect(markdownPath('/gallery')).toBe('/gallery.md');
    expect(markdownPath('/specs/demo/')).toBe('/specs/demo.md');
    expect(markdownPath('/podcasting-2.0')).toBe('/podcasting-2.0.md');
  });
});

describe('negotiate', () => {
  it('serves the twin as text/markdown with Vary: Accept', async () => {
    const res = await negotiate(req('/', 'text/markdown'), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    expect(res.headers.get('Vary')).toBe('Accept');
    expect(await res.text()).toBe('# Home');
    expect(new URL(env.ASSETS.seen.at(-1).url).pathname).toBe('/index.md');
  });
  it('returns null for browsers, other methods, assets and pages without a twin', async () => {
    expect(await negotiate(req('/', 'text/html'), env)).toBeNull();
    expect(await negotiate(req('/', 'text/markdown', 'POST'), env)).toBeNull();
    expect(await negotiate(req('/brand/logo.svg', 'text/markdown'), env)).toBeNull();
    expect(await negotiate(req('/missing/', 'text/markdown'), env)).toBeNull();
  });
});

describe('pageHeaders', () => {
  it('adds the discovery Link header to html pages', () => {
    const res = pageHeaders(html(200, { Vary: 'Accept-Encoding' }), '/gallery/', 'text/html');
    expect(res.headers.get('Vary')).toBe('Accept-Encoding');
    expect(res.headers.get('Link')).toBe(
      '</.well-known/api-catalog>; rel="api-catalog", <https://docs.minuspod.app/openapi.yaml>; rel="service-desc"; type="application/yaml", <https://docs.minuspod.app/api-and-webhooks/>; rel="service-doc", </gallery.md>; rel="alternate"; type="text/markdown"',
    );
    expect(pageHeaders(html(), '/', null).headers.get('Link')).toContain('</index.md>; rel="alternate"');
  });
  it('varies on Accept only when the request mentioned text/markdown', () => {
    expect(pageHeaders(html(), '/', 'text/markdown, text/html').headers.get('Vary')).toBe('Accept');
    expect(pageHeaders(html(), '/', 'text/html,*/*;q=0.8').headers.has('Vary')).toBe(false);
  });
  it('leaves assets and error pages alone', () => {
    const png = pageHeaders(new Response('x', { headers: { 'Content-Type': 'image/png' } }), '/x.png', 'text/markdown');
    expect(png.headers.has('Link')).toBe(false);
    const missing = pageHeaders(html(404), '/nope/', 'text/markdown');
    expect(missing.headers.has('Link')).toBe(false);
    expect(missing.headers.has('Vary')).toBe(false);
  });
});
