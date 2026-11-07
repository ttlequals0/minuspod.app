import { test, expect } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractPitch, groupScreenshots, missingCuts, pngSize, posterStale } from './prepare-landing.mjs';
import { parseVideoTable } from './lib/videos.mjs';
import { mainDir } from './lib/main-dir.mjs';

const readme = readFileSync(`${mainDir()}/docs/videos/README.md`, 'utf8');

const row = (title, name, secs, desc) => `| ${title} | [a](minuspod-${name}.mp4) | [b](minuspod-${name}-landscape.mp4) | ${secs} s | ${desc} |`;
const header = '| Video | Portrait | Landscape | Length | What it shows |\n|---|---|---|---|---|\n';

test('parses table rows into names, titles, seconds and plain descriptions', () => {
  const rows = parseVideoTable(`${header}${row('UI tour', 'demo', 108, 'Dashboard and [more](../web-interface.md).')}\n${row('How it works', 'how-it-works', 107, 'One episode.')}\n`);
  expect(rows).toEqual([
    { name: 'demo', title: 'UI tour', seconds: 108, description: 'Dashboard and more.' },
    { name: 'how-it-works', title: 'How it works', seconds: 107, description: 'One episode.' },
  ]);
});

test('trims a trailing source-path sentence from a description', () => {
  const rows = parseVideoTable(`${header}${row('Modes', 'modes', 73, 'Five modes. Animated, source in [modes/](modes/).')}\n`);
  expect(rows[0].description).toBe('Five modes.');
});

test('the upstream video table is well formed', () => {
  const rows = parseVideoTable(readme);
  expect(rows.length).toBeGreaterThan(0);
  for (const r of rows) {
    expect(r.name).toBeTruthy();
    expect(r.title).toBeTruthy();
    expect(r.description).toBeTruthy();
    expect(Number.isInteger(r.seconds) && r.seconds > 0).toBe(true);
    expect(existsSync(`${mainDir()}/docs/videos/minuspod-${r.name}-landscape.mp4`)).toBe(true);
    expect(r.description.endsWith('/.')).toBe(false);
  }
});

test('extracts the pitch paragraph and strips markup', () => {
  const pitch = extractPitch('# T\n\nbadge\n\nMinusPod is a **self-hosted** server\nfor [podcasts](x.md) <br>.\n\nNext.\n');
  expect(pitch).toBe('MinusPod is a self-hosted server for podcasts .');
});

test('the upstream pitch is a plain non-empty paragraph', () => {
  const pitch = extractPitch(readFileSync(`${mainDir()}/README.md`, 'utf8'));
  expect(pitch.length).toBeGreaterThan(0);
  expect(pitch).not.toMatch(/\[[^\]]*\]\([^)]*\)/);
  expect(pitch).not.toContain('<');
});

test('pairs desktop and mobile screenshots and labels them', () => {
  const groups = groupScreenshots(['ad-editor-desktop.png', 'ad-editor-mobile.png', 'dashboard-desktop-nord.png', 'dashboard-mobile-nord.png', 'dashboard-themes.png', 'podcasting-2.0-validator.png']);
  expect(groups).toEqual([
    { label: 'Ad editor', files: [{ file: 'ad-editor-desktop.png', kind: 'desktop' }, { file: 'ad-editor-mobile.png', kind: 'mobile' }] },
    { label: 'Dashboard (Nord theme)', files: [{ file: 'dashboard-desktop-nord.png', kind: 'desktop' }, { file: 'dashboard-mobile-nord.png', kind: 'mobile' }] },
    { label: 'Dashboard themes', files: [{ file: 'dashboard-themes.png', kind: 'single' }] },
    { label: 'Podcasting 2.0 validator', files: [{ file: 'podcasting-2.0-validator.png', kind: 'single' }] },
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

test('missingCuts names the portrait or landscape file a table row lacks', () => {
  const rows = [{ name: 'a' }, { name: 'b' }];
  expect(missingCuts(rows, ['minuspod-a.mp4', 'minuspod-a-landscape.mp4', 'minuspod-b-landscape.mp4'])).toEqual(['minuspod-b.mp4']);
  expect(missingCuts(rows, ['minuspod-a.mp4', 'minuspod-a-landscape.mp4', 'minuspod-b.mp4', 'minuspod-b-landscape.mp4'])).toEqual([]);
});
