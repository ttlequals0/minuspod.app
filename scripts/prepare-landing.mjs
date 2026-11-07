import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mainDir } from './lib/main-dir.mjs';
import { parseVideoTable } from './lib/videos.mjs';
import { stripMarkdown } from './lib/md.mjs';

export { parseVideoTable };

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const humanize = (t) => cap(t.replace(/-/g, ' '));

export function groupScreenshots(files) {
  const groups = new Map();
  for (const f of files) {
    const m = /^(.+?)-(desktop|mobile)(?:-(.+))?\.png$/.exec(f);
    const base = m ? (m[3] ? `${m[1]}-${m[3]}` : m[1]) : f.replace(/\.png$/, '');
    if (!groups.has(base)) {
      const label = m?.[3] ? `${humanize(m[1])} (${cap(m[3])} theme)` : humanize(base);
      groups.set(base, { base, label, desktop: null, mobile: null, single: null });
    }
    groups.get(base)[m ? m[2] : 'single'] = f;
  }
  return [...groups.values()].sort((a, b) => (a.base < b.base ? -1 : a.base > b.base ? 1 : 0));
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function pngSize(path) {
  const b = readFileSync(path);
  if (b.length < 24 || !b.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${path} is not a PNG file`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

export function extractPitch(readme) {
  const para = readme.split(/\n\s*\n/).find((p) => p.trim().startsWith('MinusPod is'));
  if (!para) throw new Error('Pitch paragraph starting with "MinusPod is" not found');
  return stripMarkdown(para.replace(/<[^>]*>/g, '').replace(/\s*\n\s*/g, ' ').trim());
}

const BRAND = ['logo.svg', 'logo-dark.svg', 'favicon.svg', 'apple-touch-icon.png'];

export const posterStale = (mp4, jpg) => !existsSync(jpg) || statSync(jpg).mtimeMs <= statSync(mp4).mtimeMs;

function poster(mp4, jpg) {
  if (!posterStale(mp4, jpg)) return false;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1', '-i', mp4, '-frames:v', '1', '-q:v', '3', jpg], { stdio: 'pipe' });
  return true;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const main = mainDir();
  const out = (p) => {
    const d = resolve(root, 'landing', p);
    rmSync(d, { recursive: true, force: true });
    mkdirSync(d, { recursive: true });
    return d;
  };
  // Posters are cached outside the emptied output dir so a rerun skips ffmpeg.
  const posterCache = resolve(root, 'node_modules/.cache/minuspod-posters');
  mkdirSync(posterCache, { recursive: true });
  const videosOut = out('public/videos');
  const shotsOut = out('public/screenshots');
  const brandOut = out('public/brand');
  const genOut = out('src/generated');

  const videosSrc = `${main}/docs/videos`;
  const mp4s = readdirSync(videosSrc).filter((f) => f.endsWith('.mp4'));
  let rendered = 0;
  for (const f of mp4s) {
    copyFileSync(`${videosSrc}/${f}`, `${videosOut}/${f}`);
    const m = /^minuspod-(.+?)(-landscape)?\.mp4$/.exec(f);
    if (!m) continue;
    const jpg = `${m[1]}-${m[2] ? 'landscape' : 'portrait'}.jpg`;
    if (poster(`${videosSrc}/${f}`, `${posterCache}/${jpg}`)) rendered++;
    copyFileSync(`${posterCache}/${jpg}`, `${videosOut}/${jpg}`);
  }

  const shots = readdirSync(`${main}/docs/screenshots`).filter((f) => f.endsWith('.png'));
  for (const f of shots) copyFileSync(`${main}/docs/screenshots/${f}`, `${shotsOut}/${f}`);
  const groups = groupScreenshots(shots).map((g) => {
    const sizes = {};
    for (const f of [g.desktop, g.mobile, g.single]) if (f) sizes[f] = pngSize(`${shotsOut}/${f}`);
    return { ...g, sizes };
  });
  for (const f of BRAND) copyFileSync(`${main}/frontend/public/${f}`, `${brandOut}/${f}`);

  const rows = parseVideoTable(readFileSync(`${videosSrc}/README.md`, 'utf8'));
  writeFileSync(`${genOut}/videos.json`, JSON.stringify(rows, null, 2) + '\n');
  writeFileSync(`${genOut}/screenshots.json`, JSON.stringify(groups, null, 2) + '\n');
  const pitch = extractPitch(readFileSync(`${main}/README.md`, 'utf8'));
  writeFileSync(`${genOut}/pitch.json`, JSON.stringify({ pitch }, null, 2) + '\n');
  console.log(`prepare-landing: ${mp4s.length} videos (${rendered} posters rendered), ${shots.length} screenshots in ${groups.length} groups, ${BRAND.length} brand files, ${rows.length} table rows`);
}
