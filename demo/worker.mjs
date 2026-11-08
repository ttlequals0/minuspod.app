// run_worker_first sends everything except /assets, /demo and /feeds-xml here.
const NOINDEX = { 'X-Robots-Tag': 'noindex, nofollow' };
const FEED_PATH = /^\/([A-Za-z0-9._-]+?)(\.xml|\.rss)?$/;
const slugCache = new WeakMap(); // per ASSETS binding, so once per isolate in production

function loadSlugs(env, url) {
  if (!slugCache.has(env.ASSETS)) {
    slugCache.set(
      env.ASSETS,
      env.ASSETS.fetch(new URL('/feeds-xml/index.json', url))
        .then((res) => (res.ok ? res.json() : []))
        .then((list) => new Set(Array.isArray(list) ? list : []))
        .catch(() => new Set()),
    );
  }
  return slugCache.get(env.ASSETS);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return Response.json(
        { error: 'The demo answers API calls in the browser. Reload the page and try again.' },
        { status: 503, headers: { 'Cache-Control': 'no-store', ...NOINDEX } },
      );
    }
    const match = FEED_PATH.exec(pathname);
    if (match && (request.method === 'GET' || request.method === 'HEAD') && (await loadSlugs(env, url)).has(match[1])) {
      const asset = await env.ASSETS.fetch(new URL(`/feeds-xml/${match[1]}.xml`, url));
      const type = asset.headers.get('Content-Type') || '';
      if (asset.ok && /^(application|text)\/xml/.test(type)) {
        return new Response(request.method === 'HEAD' ? null : asset.body, {
          headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600', ...NOINDEX },
        });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
