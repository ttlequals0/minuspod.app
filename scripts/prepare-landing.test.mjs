import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseVideoTable, extractPitch } from './prepare-landing.mjs';
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
