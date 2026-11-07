import { test, expect } from 'vitest';
import { headingSlug } from './md.mjs';

test('headingSlug lowercases, hyphenates and strips code ticks', () => {
  expect(headingSlug('Held for Review')).toBe('held-for-review');
  expect(headingSlug('The `x-y` flag')).toBe('the-x-y-flag');
});
