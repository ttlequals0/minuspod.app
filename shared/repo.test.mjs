import { expect, test } from 'vitest';
import { REPO_URL, formatCount } from './repo.mjs';

test('counts stay exact below a thousand and compact above', () => {
  expect(formatCount(0)).toBe('0');
  expect(formatCount(537)).toBe('537');
  expect(formatCount(1234)).toBe('1.2K');
  expect(formatCount(12345)).toBe('12.3K');
});

test('the repo link points at the public repository', () => {
  expect(REPO_URL).toBe('https://github.com/ttlequals0/MinusPod');
});
