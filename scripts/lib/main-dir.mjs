import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// A source repo checkout: the env var wins, else the gitignored clone fetch-main.sh makes.
function sourceDir(name, env, dir, sentinel) {
  const path = process.env[env] || join(repoRoot, dir);
  if (!existsSync(join(path, sentinel))) {
    throw new Error(`${name} repo not found at ${path}; run npm run fetch:main or set ${env}`);
  }
  return path;
}

export const mainDir = () => sourceDir('Main', 'MAIN_REPO_DIR', '.main', 'docs/README.md');
// The Jev proxy repo carries its own benchmark, published under /benchmarks/jev/.
export const jevDir = () => sourceDir('MinusPodJev', 'JEV_REPO_DIR', '.jev', 'benchmark/README.md');
