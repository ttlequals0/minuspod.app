import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { isMain } from './lib/cli.mjs';
import { repoRoot } from './lib/main-dir.mjs';
import { REPO } from '../shared/repo.mjs';

// GitHub requires a User-Agent. Without a token the limit is 60 requests an hour per address, shared by every job on a runner.
export async function fetchRepoStats(fetchFn = fetch, token = process.env.GITHUB_TOKEN) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'minuspod.app-build' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetchFn(`https://api.github.com/repos/${REPO}`, { headers, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`GitHub API answered ${res.status} for ${REPO}`);
  const { stargazers_count: stars, forks_count: forks } = await res.json();
  if (!Number.isInteger(stars) || !Number.isInteger(forks)) throw new Error(`GitHub API payload for ${REPO} has no counts`);
  return { stars, forks };
}

if (isMain(import.meta.url)) {
  // a GitHub hiccup must not block a deploy: the footer then falls back to a plain link
  let stats = { stars: null, forks: null };
  try {
    stats = await fetchRepoStats();
  } catch (e) {
    console.warn(`repo-stats: ${e.message}; the footer falls back to a plain GitHub link`);
  }
  const out = resolve(repoRoot, 'shared/generated/repo-stats.json');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(stats, null, 2) + '\n');
  console.log(`repo-stats: ${REPO} ${stats.stars} stars, ${stats.forks} forks`);
}
