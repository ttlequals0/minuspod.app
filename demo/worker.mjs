// run_worker_first sends everything except /assets, /demo and /feeds-xml here.
const NOINDEX = { 'X-Robots-Tag': 'noindex, nofollow' };
const FEED_PATH = /^\/([A-Za-z0-9._-]+?)(\.xml|\.rss)?$/;
const FILE_PATH = /\.(?!html?$)(?=[0-9]*[A-Za-z])[A-Za-z0-9]{1,8}$/; // an extension with a letter in it; .html keeps the SPA fallback
const slugCache = new WeakMap(); // per ASSETS binding, so once per isolate in production

function loadSlugs(env, url) {
  if (!slugCache.has(env.ASSETS)) {
    const load = env.ASSETS.fetch(new URL('/feeds-xml/index.json', url))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`index.json ${res.status}`))))
      .then((list) => new Set(Array.isArray(list) ? list : []))
      .catch(() => {
        slugCache.delete(env.ASSETS); // only a successful load is kept for the isolate
        return new Set();
      });
    slugCache.set(env.ASSETS, load);
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
        const headers = { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600', ...NOINDEX };
        const etag = asset.headers.get('ETag');
        if (etag) headers.ETag = etag; // lets podcast clients revalidate instead of refetching
        return new Response(request.method === 'HEAD' ? null : asset.body, { headers });
      }
    }
    const res = await env.ASSETS.fetch(request);
    // The SPA fallback would answer /sitemap.xml or /x.php with the app shell, so file-like paths get a 404.
    if (FILE_PATH.test(pathname) && res.ok && /text\/html/.test(res.headers.get('Content-Type') || '')) {
      return new Response(request.method === 'HEAD' ? null : 'Not found', { status: 404, headers: { 'Cache-Control': 'no-store', ...NOINDEX } });
    }
    return res;
  },
};
