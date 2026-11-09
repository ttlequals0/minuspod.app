import { describe, expect, it } from 'vitest';
import { fetchRepoStats } from './repo-stats.mjs';

const payload = { stargazers_count: 537, forks_count: 54, subscribers_count: 3 };
const respond = (ok, status, body) => async () => ({ ok, status, json: async () => body });

describe('fetchRepoStats', () => {
  it('asks the GitHub API for the repo and keeps the two counts', async () => {
    const calls = [];
    const fetchFn = async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => payload };
    };
    expect(await fetchRepoStats(fetchFn, '')).toEqual({ stars: 537, forks: 54 });
    expect(calls[0].url).toBe('https://api.github.com/repos/ttlequals0/MinusPod');
    expect(calls[0].init.headers['User-Agent']).toBeTruthy();
    expect(calls[0].init.headers.Authorization).toBeUndefined();
  });

  it('sends the token as a bearer header when one is set', async () => {
    const calls = [];
    const fetchFn = async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => payload };
    };
    await fetchRepoStats(fetchFn, 'ghs_x');
    expect(calls[0].init.headers.Authorization).toBe('Bearer ghs_x');
  });

  it('rejects an error status and a payload without counts', async () => {
    await expect(fetchRepoStats(respond(false, 403, {}), '')).rejects.toThrow('403');
    await expect(fetchRepoStats(respond(true, 200, { message: 'Moved' }), '')).rejects.toThrow('no counts');
  });
});
