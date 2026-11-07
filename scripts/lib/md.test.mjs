import { test, expect } from 'vitest';
import { headingSlug, linkText } from './md.mjs';

test('headingSlug lowercases, hyphenates and strips code ticks', () => {
  expect(headingSlug('Held for Review')).toBe('held-for-review');
  expect(headingSlug('The `x-y` flag')).toBe('the-x-y-flag');
});

test('linkText drops images, including an image wrapped in a link', () => {
  expect(linkText('Run [![b](a.png)](b.md) now')).toBe('Run  now');
  expect(linkText('See [docs](x.md) and ![pic](p.png "t")')).toBe('See docs and ');
});
