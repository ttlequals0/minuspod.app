import { test, expect } from 'vitest';
import { mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseVideoTable, extractPitch, groupScreenshots, pngSize, posterStale } from './prepare-landing.mjs';
import { mainDir } from './lib/main-dir.mjs';

const readme = readFileSync(`${mainDir()}/docs/videos/README.md`, 'utf8');

test('parses ten videos with names, seconds and plain descriptions', () => {
  const rows = parseVideoTable(readme);
  expect(rows).toHaveLength(10);
  expect(rows[0]).toMatchObject({ name: 'demo', title: 'UI tour', seconds: 108 });
  expect(rows[1].description).toContain('Follows How It Works and Episode Processing Workflows');
  expect(rows.map(r => r.name)).toEqual(['demo','how-it-works','review-queue','audio-cues','processing-modes','local-feeds','providers','podcasting-2','patterns','youtube']);
});

test('extracts the pitch paragraph', () => {
  const pitch = extractPitch(readFileSync(`${mainDir()}/README.md`, 'utf8'));
  expect(pitch.startsWith('MinusPod is a self-hosted server')).toBe(true);
  expect(pitch).not.toContain('<');
});

test('pairs desktop and mobile screenshots and labels them', () => {
  const groups = groupScreenshots(['ad-editor-desktop.png', 'ad-editor-mobile.png', 'dashboard-desktop-nord.png', 'dashboard-mobile-nord.png', 'dashboard-themes.png', 'podcasting-2.0-validator.png']);
  expect(groups).toEqual([
    { base: 'ad-editor', label: 'Ad editor', desktop: 'ad-editor-desktop.png', mobile: 'ad-editor-mobile.png', single: null },
    { base: 'dashboard-nord', label: 'Dashboard (Nord theme)', desktop: 'dashboard-desktop-nord.png', mobile: 'dashboard-mobile-nord.png', single: null },
    { base: 'dashboard-themes', label: 'Dashboard themes', desktop: null, mobile: null, single: 'dashboard-themes.png' },
    { base: 'podcasting-2.0-validator', label: 'Podcasting 2.0 validator', desktop: null, mobile: null, single: 'podcasting-2.0-validator.png' },
  ]);
});

test('pngSize reads the header and rejects a file without the PNG signature', () => {
  const dir = mkdtempSync(join(tmpdir(), 'png-'));
  const png = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
  png.writeUInt32BE(640, 16);
  png.writeUInt32BE(480, 20);
  writeFileSync(join(dir, 'a.png'), png);
  writeFileSync(join(dir, 'b.png'), Buffer.alloc(24));
  expect(pngSize(join(dir, 'a.png'))).toEqual({ w: 640, h: 480 });
  expect(() => pngSize(join(dir, 'b.png'))).toThrow(/b\.png.*PNG/);
});

test('posterStale is false only for a poster newer than its source', () => {
  const dir = mkdtempSync(join(tmpdir(), 'poster-'));
  const mp4 = join(dir, 'a.mp4');
  const jpg = join(dir, 'a.jpg');
  writeFileSync(mp4, '');
  expect(posterStale(mp4, jpg)).toBe(true);
  writeFileSync(jpg, '');
  utimesSync(mp4, 1000, 1000);
  utimesSync(jpg, 2000, 2000);
  expect(posterStale(mp4, jpg)).toBe(false);
  utimesSync(mp4, 3000, 3000);
  expect(posterStale(mp4, jpg)).toBe(true);
});
