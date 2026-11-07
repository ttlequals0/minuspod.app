import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { isMain, resetDir } from './lib/cli.mjs';
import { mainDir, repoRoot } from './lib/main-dir.mjs';
import { parseVideoTable } from './lib/videos.mjs';
import { stripMarkdown } from './lib/md.mjs';

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const humanize = (t) => cap(t.replace(/-/g, ' '));

// the validator capture is a third-party site, not the app
export const EXCLUDED_SHOTS = new Set(['podcasting-2.0-validator.png']);
export const landingShots = (files) => files.filter((f) => f.endsWith('.png') && !EXCLUDED_SHOTS.has(f));

// whole-app views first, then feature screens; unlisted screenshots follow in name order, unlisted videos in table order
export const GALLERY_ORDER = ['dashboard', 'dashboard-nord', 'dashboard-themes', 'feed-detail', 'episode-detail', 'queue', 'history', 'stats',
  'ads-detected', 'ad-editor', 'sponsors', 'patterns', 'cue-matches', 'cue-templates', 'cue-editor', 'settings', 'cover-art-badge'];
export const VIDEO_ORDER = ['demo', 'how-it-works', 'processing-modes', 'review-queue', 'patterns', 'audio-cues', 'local-feeds', 'providers', 'podcasting-2', 'youtube'];
const rank = (order, k) => {
  const i = order.indexOf(k);
  return i === -1 ? order.length : i;
};

export function groupScreenshots(files) {
  const groups = new Map();
  for (const f of [...files].sort()) {
    const m = /^(.+?)-(desktop|mobile)(?:-(.+))?\.png$/.exec(f);
    const base = m ? (m[3] ? `${m[1]}-${m[3]}` : m[1]) : f.replace(/\.png$/, '');
    if (!groups.has(base)) {
      const label = m?.[3] ? `${humanize(m[1])} (${cap(m[3])} theme)` : humanize(base);
      groups.set(base, { label, files: [] });
    }
    groups.get(base).files.push({ file: f, kind: m ? m[2] : 'single' });
  }
  // insertion order is already alphabetical, so the stable sort keeps unlisted groups in name order
  return [...groups.entries()].sort(([a], [b]) => rank(GALLERY_ORDER, a) - rank(GALLERY_ORDER, b)).map(([, g]) => g);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function pngSize(path) {
  const b = Buffer.alloc(24);
  const fd = openSync(path, 'r');
  const n = readSync(fd, b, 0, 24, 0);
  closeSync(fd);
  if (n < 24 || !b.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${path} is not a PNG file`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

export function extractPitch(readme) {
  const para = readme.split(/\n\s*\n/).find((p) => p.trim().startsWith('MinusPod is'));
  if (!para) throw new Error('Pitch paragraph starting with "MinusPod is" not found');
  return stripMarkdown(para.replace(/<[^>]*>/g, '').replace(/\s*\n\s*/g, ' ').trim());
}

const BRAND = ['logo.svg', 'logo-dark.svg', 'favicon.svg', 'apple-touch-icon.png'];

export const posterStale = (mp4, jpg) => !existsSync(jpg) || statSync(jpg).mtimeMs <= statSync(mp4).mtimeMs;

// the player derives the portrait file from the landscape link, so every table row needs both cuts
export const missingCuts = (rows, files) =>
  rows.flatMap((r) => [`minuspod-${r.name}.mp4`, `minuspod-${r.name}-landscape.mp4`]).filter((f) => !files.includes(f));

function poster(mp4, jpg) {
  if (!posterStale(mp4, jpg)) return false;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1', '-i', mp4, '-frames:v', '1', '-q:v', '3', jpg], { stdio: 'pipe' });
  return true;
}

if (isMain(import.meta.url)) {
  const root = repoRoot;
  const main = mainDir();
  const out = (p) => resetDir(resolve(root, 'landing', p));
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

  const shots = landingShots(readdirSync(`${main}/docs/screenshots`));
  for (const f of shots) copyFileSync(`${main}/docs/screenshots/${f}`, `${shotsOut}/${f}`);
  const groups = groupScreenshots(shots).map((g) => ({
    label: g.label,
    files: g.files.map((f) => ({ ...f, ...pngSize(`${shotsOut}/${f.file}`) })),
  }));
  for (const f of BRAND) copyFileSync(`${main}/frontend/public/${f}`, `${brandOut}/${f}`);

  const rows = parseVideoTable(readFileSync(`${videosSrc}/README.md`, 'utf8'));
  const missing = missingCuts(rows, mp4s);
  if (missing.length) throw new Error(`prepare-landing: missing video cuts: ${missing.join(', ')}`);
  rows.sort((a, b) => rank(VIDEO_ORDER, a.name) - rank(VIDEO_ORDER, b.name));
  writeFileSync(`${genOut}/videos.json`, JSON.stringify(rows, null, 2) + '\n');
  writeFileSync(`${genOut}/screenshots.json`, JSON.stringify(groups, null, 2) + '\n');
  const pitch = extractPitch(readFileSync(`${main}/README.md`, 'utf8'));
  writeFileSync(`${genOut}/pitch.json`, JSON.stringify({ pitch }, null, 2) + '\n');
  console.log(`prepare-landing: ${mp4s.length} videos (${rendered} posters rendered), ${shots.length} screenshots in ${groups.length} groups, ${BRAND.length} brand files, ${rows.length} table rows`);
}
