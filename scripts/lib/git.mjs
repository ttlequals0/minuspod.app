import { execFileSync } from 'node:child_process';

export const git = (exec, dir, ...args) => exec('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();

// a shallow clone would date every file by its only commit
export function assertFullHistory(dir, exec = execFileSync) {
  if (git(exec, dir, 'rev-parse', '--is-shallow-repository') === 'true') {
    throw new Error(`${dir} is a shallow clone without the commit dates; rerun npm run fetch:main`);
  }
}

// repo path -> day (YYYY-MM-DD) of the last commit that touched it, newest first
export function lastCommitDates(dir, paths, exec = execFileSync) {
  assertFullHistory(dir, exec);
  const dates = new Map();
  let day;
  for (const line of git(exec, dir, 'log', '--no-renames', '--format=@%cs', '--name-only', '--', ...paths).split('\n')) {
    if (line.startsWith('@')) day = line.slice(1);
    else if (line && !dates.has(line)) dates.set(line, day);
  }
  return dates;
}
