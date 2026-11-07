import { test, expect } from 'vitest';
import { collectSlugs } from './check-dist.mjs';

test('collectSlugs returns only page slugs', () => {
  const sidebar = [
    'top',
    {
      label: 'Group',
      items: [
        'a',
        { slug: 'b' },
        { label: 'Ext', link: 'https://example.com/' },
        { label: 'Auto', autogenerate: { directory: 'specs' } },
        { label: 'Nested', items: ['c'] },
      ],
    },
  ];
  expect(collectSlugs(sidebar)).toEqual(['top', 'a', 'b', 'c']);
});
