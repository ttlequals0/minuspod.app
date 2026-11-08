import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

const xml = () => new Response('<?xml version="1.0"?><rss/>', { headers: { 'Content-Type': 'application/xml' } });
const html = () => new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } });

// ASSETS stub: index.json lists `slugs`; /feeds-xml/<slug>.xml answers with `feed`; the rest is the SPA shell
function env(feed, slugs = ['show']) {
  const calls = [];
  return {
    calls,
    xmlCalls: () => calls.filter((c) => c.startsWith('/feeds-xml/') && c !== '/feeds-xml/index.json'),
    ASSETS: {
      async fetch(req) {
        const path = new URL(req instanceof Request ? req.url : req).pathname;
        calls.push(path);
        if (path === '/feeds-xml/index.json') return Response.json(slugs);
        return path.startsWith('/feeds-xml/') ? feed() : html();
      },
    },
  };
}
const get = (e, path, method = 'GET') => worker.fetch(new Request(`https://demo.test${path}`, { method }), e);

test('api paths answer 503 JSON with noindex', async () => {
  const e = env(xml);
  const res = await get(e, '/api/v1/x');
  assert.equal(res.status, 503);
  assert.match(res.headers.get('Content-Type'), /json/);
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.deepEqual(e.calls, []);
});

test('bare /api answers 503', async () => {
  assert.equal((await get(env(xml), '/api')).status, 503);
});

test('/apix is not an API path', async () => {
  const res = await get(env(xml), '/apix');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type'), /html/);
});

test('/ goes straight to ASSETS', async () => {
  const e = env(xml);
  const res = await get(e, '/');
  assert.match(res.headers.get('Content-Type'), /html/);
  assert.deepEqual(e.calls, ['/']);
});

for (const path of ['/show', '/show.xml', '/show.rss']) {
  test(`${path} serves the feed asset as XML`, async () => {
    const e = env(xml);
    const res = await get(e, path);
    assert.equal(res.headers.get('Content-Type'), 'application/xml; charset=utf-8');
    assert.equal(res.headers.get('Cache-Control'), 'public, max-age=3600');
    assert.equal(res.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.match(await res.text(), /^<\?xml/);
    assert.deepEqual(e.xmlCalls(), ['/feeds-xml/show.xml']);
  });
}

test('HEAD returns the feed headers with no body', async () => {
  const res = await get(env(xml), '/show', 'HEAD');
  assert.equal(res.headers.get('Content-Type'), 'application/xml; charset=utf-8');
  assert.equal(res.headers.get('Cache-Control'), 'public, max-age=3600');
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.equal(res.body, null);
});

test('a multi-segment path is never looked up as a feed', async () => {
  const e = env(xml);
  const res = await get(e, '/feeds/show');
  assert.match(res.headers.get('Content-Type'), /html/);
  assert.deepEqual(e.xmlCalls(), []);
  assert.equal(e.calls.at(-1), '/feeds/show');
});

test('an unlisted single-segment path makes no XML lookup', async () => {
  const e = env(xml);
  const res = await get(e, '/unknown');
  assert.match(res.headers.get('Content-Type'), /html/);
  assert.deepEqual(e.xmlCalls(), []);
});

test('a listed slug whose asset is HTML falls through', async () => {
  const e = env(html);
  const res = await get(e, '/show');
  assert.match(res.headers.get('Content-Type'), /html/);
  assert.deepEqual(e.calls.at(-1), '/show');
});

test('a missing index.json means no feeds', async () => {
  const e = env(xml);
  const orig = e.ASSETS.fetch;
  e.ASSETS.fetch = async (req) => (new URL(req instanceof Request ? req.url : req).pathname === '/feeds-xml/index.json' ? new Response('', { status: 404 }) : orig(req));
  const res = await get(e, '/show');
  assert.match(res.headers.get('Content-Type'), /html/);
});

test('the asset ETag is passed through so clients can revalidate', async () => {
  const tagged = () => new Response('<?xml version="1.0"?><rss/>', { headers: { 'Content-Type': 'application/xml', ETag: '"abc"' } });
  const res = await get(env(tagged), '/show');
  assert.equal(res.headers.get('ETag'), '"abc"');
  assert.equal((await get(env(xml), '/show')).headers.get('ETag'), null);
});

test('a failed manifest load is retried on the next request', async () => {
  let indexCalls = 0;
  const e = {
    ASSETS: {
      async fetch(req) {
        const path = new URL(req instanceof Request ? req.url : req).pathname;
        if (path === '/feeds-xml/index.json') {
          indexCalls += 1;
          if (indexCalls === 1) throw new Error('transient');
          if (indexCalls === 2) return new Response('missing', { status: 404 });
          return Response.json(['show']);
        }
        return path.startsWith('/feeds-xml/') ? xml() : html();
      },
    },
  };
  assert.match((await get(e, '/show')).headers.get('Content-Type'), /html/); // thrown
  assert.match((await get(e, '/show')).headers.get('Content-Type'), /html/); // 404, not cached either
  assert.equal((await get(e, '/show')).headers.get('Content-Type'), 'application/xml; charset=utf-8');
  assert.equal(indexCalls, 3);
});

test('unknown file-like paths answer 404 instead of the app shell', async () => {
  const e = env(xml);
  for (const path of ['/sitemap.xml', '/wp-login.php', '/missing.json']) {
    const res = await get(e, path);
    assert.equal(res.status, 404, path);
    assert.equal(res.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.match(res.headers.get('Content-Type'), /text\/plain/);
  }
  assert.equal((await get(e, '/sitemap.xml', 'HEAD')).body, null);
  assert.equal((await get(e, '/unlisted.xml')).status, 404, 'an unlisted feed slug with .xml is a missing file, not an app route');
});

test('app routes and .html paths keep the SPA fallback', async () => {
  const e = env(xml);
  for (const path of ['/feeds/42', '/feeds/my.show', '/feeds/the.daily/episodes/x.y', '/settings', '/anything.html', '/v1.2']) {
    assert.equal((await get(e, path)).status, 200, path);
  }
});
