import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function mainDir() {
  const dir = process.env.MAIN_REPO_DIR || join(repoRoot, '.main');
  if (!existsSync(join(dir, 'docs', 'README.md'))) {
    throw new Error(`Main repo not found at ${dir}; run npm run fetch:main or set MAIN_REPO_DIR`);
  }
  return dir;
}

// The Jev proxy repo carries its own benchmark, published under /benchmarks/jev/.
export function jevDir() {
  const dir = process.env.JEV_REPO_DIR || join(repoRoot, '.jev');
  if (!existsSync(join(dir, 'benchmark', 'README.md'))) {
    throw new Error(`MinusPodJev repo not found at ${dir}; run npm run fetch:main or set JEV_REPO_DIR`);
  }
  return dir;
}
