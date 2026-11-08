import { afterEach, beforeEach, test, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { jevDir, mainDir } from './main-dir.mjs';

let saved;
beforeEach(() => {
  saved = { main: process.env.MAIN_REPO_DIR, jev: process.env.JEV_REPO_DIR };
});
afterEach(() => {
  for (const [key, name] of [['main', 'MAIN_REPO_DIR'], ['jev', 'JEV_REPO_DIR']]) {
    if (saved[key] === undefined) delete process.env[name];
    else process.env[name] = saved[key];
  }
});

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

test('jevDir uses JEV_REPO_DIR when it holds benchmark/README.md', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jev-'));
  mkdirSync(join(dir, 'benchmark'));
  writeFileSync(join(dir, 'benchmark', 'README.md'), '# x');
  process.env.JEV_REPO_DIR = dir;
  expect(jevDir()).toBe(dir);
});

test('jevDir throws a message naming the path when missing', () => {
  process.env.JEV_REPO_DIR = '/nonexistent/jev';
  expect(() => jevDir()).toThrow(/MinusPodJev repo not found at \/nonexistent\/jev/);
});
