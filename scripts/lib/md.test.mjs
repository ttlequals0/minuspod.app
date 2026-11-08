import { test, expect } from 'vitest';
import { headingSlug, linkText, truncateSentence } from './md.mjs';

test('headingSlug lowercases, hyphenates and strips code ticks', () => {
  expect(headingSlug('Held for Review')).toBe('held-for-review');
  expect(headingSlug('The `x-y` flag')).toBe('the-x-y-flag');
});

test('linkText drops images, including an image wrapped in a link', () => {
  expect(linkText('Run [![b](a.png)](b.md) now')).toBe('Run  now');
  expect(linkText('See [docs](x.md) and ![pic](p.png "t")')).toBe('See docs and ');
});

test.each([
  ['Short one.', 'Short one.'],
  ['First sentence here. Second sentence is long enough to pass the limit by itself.', 'First sentence here.'],
  ['Asks why? Then a second sentence that runs well past the limit we set here.', 'Asks why?'],
  ['Version 2.1 ships now. Then a second sentence that runs past the limit we set.', 'Version 2.1 ships now.'],
  ['One long sentence without any stop inside the limit keeps going and going past it', 'One long sentence without any stop inside the...'],
])('truncateSentence(%j)', (input, expected) => {
  expect(truncateSentence(input, 50)).toBe(expected);
});
