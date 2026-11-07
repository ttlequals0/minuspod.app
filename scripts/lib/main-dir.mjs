import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function mainDir() {
  const dir = process.env.MAIN_REPO_DIR || join(repoRoot, '.main');
  if (!existsSync(join(dir, 'docs', 'README.md'))) {
    throw new Error(`Main repo not found at ${dir}; run npm run fetch:main or set MAIN_REPO_DIR`);
  }
  return dir;
}
