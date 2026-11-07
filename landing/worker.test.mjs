import { describe, expect, it } from 'vitest';
import worker, { parseRange } from './worker.mjs';

const bytes = new Uint8Array(Array.from({ length: 100 }, (_, i) => i));
const asset = (init = {}) => ({
  seen: [],
  async fetch(req) {
    this.seen.push(req);
    return new Response(init.status === 404 ? 'missing' : bytes, { status: 200, headers: { 'Content-Type': 'video/mp4', 'Content-Length': '100', ETag: '"a"' }, ...init });
  },
});
const get = (headers = {}, env = asset(), method = 'GET') => worker.fetch(new Request('https://minuspod.app/videos/x.mp4', { method, headers }), { ASSETS: env });

describe('parseRange', () => {
  it('parses open, closed and suffix ranges and clamps to the file', () => {
    expect(parseRange('bytes=10-', 100)).toEqual({ start: 10, end: 99 });
    expect(parseRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=0-500', 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=-500', 100)).toEqual({ start: 0, end: 99 });
  });
  it('returns null for missing, malformed, multi or reversed ranges', () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange('bytes=-', 100)).toBeNull();
    expect(parseRange('items=0-1', 100)).toBeNull();
    expect(parseRange('bytes=0-1,5-6', 100)).toBeNull();
    expect(parseRange('bytes=20-10', 100)).toBeNull();
  });
  it('reports a start past the end as unsatisfiable', () => {
    expect(parseRange('bytes=100-', 100)).toEqual({ start: 100, end: 99 });
  });
});

describe('worker', () => {
  it('serves the full file with Accept-Ranges when no range is asked', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    expect((await res.arrayBuffer()).byteLength).toBe(100);
  });
  it('strips Range and If-Range from the asset subrequest', async () => {
    const env = asset();
    await get({ Range: 'bytes=0-1', 'If-Range': '"a"' }, env);
    expect(env.seen[0].headers.has('Range')).toBe(false);
    expect(env.seen[0].headers.has('If-Range')).toBe(false);
  });
  it('slices the requested bytes into a 206', async () => {
    const res = await get({ Range: 'bytes=10-19' });
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 10-19/100');
    expect(res.headers.get('Content-Length')).toBe('10');
    expect(res.headers.get('Content-Type')).toBe('video/mp4');
    expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  });
  it('answers an unsatisfiable range with 416 and no body headers', async () => {
    const res = await get({ Range: 'bytes=500-' });
    expect(res.status).toBe(416);
    expect(res.headers.get('Content-Range')).toBe('bytes */100');
    expect(res.headers.has('Content-Length')).toBe(false);
    expect(res.headers.has('Content-Type')).toBe(false);
  });
  it('serves the whole file when the range is malformed or If-Range does not match', async () => {
    expect((await get({ Range: 'bytes=0-1,5-6' })).status).toBe(200);
    const stale = await get({ Range: 'bytes=10-19', 'If-Range': '"old"' });
    expect(stale.status).toBe(200);
    expect((await stale.arrayBuffer()).byteLength).toBe(100);
    expect((await get({ Range: 'bytes=10-19', 'If-Range': '"a"' })).status).toBe(206);
  });
  it('passes non-GET and non-200 responses through untouched', async () => {
    const head = await get({ Range: 'bytes=0-1' }, asset(), 'HEAD');
    expect(head.status).toBe(200);
    const missing = await get({ Range: 'bytes=0-1' }, asset({ status: 404 }));
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe('missing');
  });
});
