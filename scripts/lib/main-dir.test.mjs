import { test, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mainDir } from './main-dir.mjs';

test('uses MAIN_REPO_DIR when it holds docs/README.md', () => {
  const dir = mkdtempSync(join(tmpdir(), 'main-'));
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'docs', 'README.md'), '# x');
  process.env.MAIN_REPO_DIR = dir;
  expect(mainDir()).toBe(dir);
});

test('throws a message naming the path when missing', () => {
  process.env.MAIN_REPO_DIR = '/nonexistent/x';
  expect(() => mainDir()).toThrow(/Main repo not found at \/nonexistent\/x/);
});
