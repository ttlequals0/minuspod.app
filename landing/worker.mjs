// Static assets answer Range requests with the whole file, which breaks video seeking.
// run_worker_first routes the videos here so the requested byte range is served as a 206.
// Asset misses on any path also land here, so everything else must pass through untouched.
const RANGE = /^bytes=(?:(\d+)-(\d*)|-(\d+))$/;

// null for a missing, malformed or reversed header (served as a plain GET); start >= size is unsatisfiable
export function parseRange(header, size) {
  const m = RANGE.exec(header || '');
  if (!m) return null;
  const [, from, to, suffix] = m;
  if (to && Number(to) < Number(from)) return null;
  const start = suffix ? Math.max(size - Number(suffix), 0) : Number(from);
  const end = to ? Math.min(Number(to), size - 1) : size - 1;
  return { start, end };
}

export default {
  async fetch(request, env) {
    // the asset layer ignores Range but drops Cache-Control when it sees one
    const upstream = new Request(request);
    upstream.headers.delete('Range');
    upstream.headers.delete('If-Range');
    const res = await env.ASSETS.fetch(upstream);
    const headers = new Headers(res.headers);
    headers.set('Accept-Ranges', 'bytes');
    const header = request.headers.get('Range');
    const ifRange = request.headers.get('If-Range');
    const whole = request.method !== 'GET' || res.status !== 200 || !header || (ifRange && ifRange !== res.headers.get('ETag'));
    if (whole) return new Response(res.body, { status: res.status, headers });
    // the asset response may not carry Content-Length, so size the body itself
    const body = await res.arrayBuffer();
    const range = parseRange(header, body.byteLength);
    if (!range) return new Response(body, { status: 200, headers });
    if (range.start >= body.byteLength) {
      headers.delete('Content-Length');
      headers.delete('Content-Type');
      headers.set('Content-Range', `bytes */${body.byteLength}`);
      return new Response(null, { status: 416, headers });
    }
    const length = range.end - range.start + 1;
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${body.byteLength}`);
    headers.set('Content-Length', String(length));
    return new Response(new Uint8Array(body, range.start, length), { status: 206, headers });
  },
};
