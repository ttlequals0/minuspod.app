import { expect, it } from 'vitest';
import worker from './worker.mjs';

const env = {
  ASSETS: {
    async fetch(req) {
      const path = new URL(req.url).pathname;
      if (path === '/installation.md') return new Response('# Installation', { headers: { 'Content-Type': 'text/markdown' } });
      if (path === '/installation/') return new Response('<html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      return new Response('missing', { status: 404 });
    },
  },
};
const get = (path, accept) => worker.fetch(new Request(`https://docs.minuspod.app${path}`, { headers: { Accept: accept } }), env);

it('wires negotiation and page headers around the asset binding', async () => {
  expect(await (await get('/installation/', 'text/markdown')).text()).toBe('# Installation');
  const html = await get('/installation/', 'text/html');
  expect(html.headers.has('Vary')).toBe(false);
  expect(html.headers.get('Link')).toContain('</installation.md>; rel="alternate"');
  const missing = await get('/nope/', 'text/markdown');
  expect(missing.status).toBe(404);
  expect(missing.headers.has('Link')).toBe(false);
});
