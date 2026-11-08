import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

const xml = () => new Response('<?xml version="1.0"?><rss/>', { headers: { 'Content-Type': 'application/xml' } });
const html = () => new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } });

function env(feed) {
  const calls = [];
  return {
    calls,
    ASSETS: {
      fetch(req) {
        const path = new URL(req instanceof Request ? req.url : req).pathname;
        calls.push(path);
        return path.startsWith('/feeds-xml/') ? feed() : html();
      },
    },
  };
}
const get = (e, path) => worker.fetch(new Request(`https://demo.test${path}`), e);

test('api paths answer 503 JSON with noindex', async () => {
  const e = env(xml);
  const res = await get(e, '/api/v1/x');
  assert.equal(res.status, 503);
  assert.match(res.headers.get('Content-Type'), /json/);
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.deepEqual(e.calls, []);
});

for (const path of ['/show', '/show.xml', '/show.rss']) {
  test(`${path} serves the feed asset as XML`, async () => {
    const e = env(xml);
    const res = await get(e, path);
    assert.equal(res.headers.get('Content-Type'), 'application/xml; charset=utf-8');
    assert.equal(res.headers.get('Cache-Control'), 'public, max-age=3600');
    assert.equal(res.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.match(await res.text(), /^<\?xml/);
    assert.deepEqual(e.calls, ['/feeds-xml/show.xml']);
  });
}

test('multi-segment path falls through to the SPA shell', async () => {
  const e = env(html);
  const res = await get(e, '/feeds/show');
  assert.match(res.headers.get('Content-Type'), /html/);
  assert.deepEqual(e.calls, ['/feeds/show']);
});

test('single segment with an HTML fallback falls through', async () => {
  const e = env(html);
  const res = await get(e, '/unknown');
  assert.match(res.headers.get('Content-Type'), /html/);
  assert.deepEqual(e.calls, ['/feeds-xml/unknown.xml', '/unknown']);
});

test('assets are never asked for a feed', async () => {
  const e = env(xml);
  await get(e, '/assets/app.js');
  assert.deepEqual(e.calls, ['/assets/app.js']);
});
