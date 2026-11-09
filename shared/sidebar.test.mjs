import { expect, test } from 'vitest';
import { collapseGroups, presentPages } from './sidebar.mjs';

const hasPage = (slug) => slug !== 'later';

test('entries whose page is missing are dropped, groups left empty go too', () => {
  const sidebar = [
    { label: 'A', items: [{ slug: 'now', label: 'Now' }, { slug: 'later', label: 'Later' }, { link: '/', label: 'Home' }] },
    { label: 'B', items: [{ slug: 'later', label: 'Later' }] },
    { label: 'C', items: [{ autogenerate: { directory: 'api' } }] },
  ];
  expect(presentPages(sidebar, hasPage)).toEqual([
    { label: 'A', items: [{ slug: 'now', label: 'Now' }, { link: '/', label: 'Home' }] },
    { label: 'C', items: [{ autogenerate: { directory: 'api' } }] },
  ]);
});

test('every group collapses, nested ones included, and leaves stay as they are', () => {
  const sidebar = [
    { label: 'A', items: [{ slug: 'now', label: 'Now' }, { label: 'Nested', items: [{ autogenerate: { directory: 'api' } }] }] },
    { link: '/', label: 'Home' },
  ];
  expect(collapseGroups(sidebar)).toEqual([
    { label: 'A', collapsed: true, items: [{ slug: 'now', label: 'Now' }, { label: 'Nested', collapsed: true, items: [{ autogenerate: { directory: 'api' } }] }] },
    { link: '/', label: 'Home' },
  ]);
});
