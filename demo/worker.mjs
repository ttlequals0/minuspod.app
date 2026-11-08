// Only /api and /api/* reach this script (run_worker_first); everything else is served as a static asset.
export default {
  fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) {
      return Response.json(
        { error: 'The demo answers API calls in the browser. Reload the page and try again.' },
        { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } },
      );
    }
    return env.ASSETS.fetch(request);
  },
};
