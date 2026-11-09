import { describe, expect, it } from 'vitest';
import { fetchRepoStats } from './repo-stats.mjs';

const payload = { stargazers_count: 537, forks_count: 54, subscribers_count: 3 };

// a fetch stand-in that records its calls and answers with one body
function recording(body, { ok = true, status = 200 } = {}) {
  const calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    return { ok, status, json: async () => body };
  };
  return { calls, fetchFn };
}

describe('fetchRepoStats', () => {
  it('asks the GitHub API for the repo and keeps the two counts', async () => {
    const { calls, fetchFn } = recording(payload);
    expect(await fetchRepoStats(fetchFn, '')).toEqual({ stars: 537, forks: 54 });
    expect(calls[0].url).toBe('https://api.github.com/repos/ttlequals0/MinusPod');
    expect(calls[0].init.headers['User-Agent']).toBeTruthy();
    expect(calls[0].init.headers.Authorization).toBeUndefined();
  });

  it('sends the token as a bearer header when one is set', async () => {
    const { calls, fetchFn } = recording(payload);
    await fetchRepoStats(fetchFn, 'ghs_x');
    expect(calls[0].init.headers.Authorization).toBe('Bearer ghs_x');
  });

  it('rejects an error status and a payload without counts', async () => {
    await expect(fetchRepoStats(recording({}, { ok: false, status: 403 }).fetchFn, '')).rejects.toThrow('403');
    await expect(fetchRepoStats(recording({ message: 'Moved' }).fetchFn, '')).rejects.toThrow('no counts');
  });
});
