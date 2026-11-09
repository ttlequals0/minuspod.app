import { expect, test } from 'vitest';
import { ARCHIVE_SLUG, benchmarkSidebar } from './benchmark-pages.mjs';

test('the sidebar groups pages by benchmark with the past runs after the current results', () => {
  const { label, items } = benchmarkSidebar();
  expect(label).toBe('Benchmarks');
  expect(items.map((i) => i.label)).toEqual(['LLM benchmark', 'Jev benchmark', 'Cue benchmark']);
  expect(items[0].items.map((i) => i.label)).toEqual(['Overview', 'Results', 'Past runs', 'Parsing and moderation', 'Corpus', 'Contributing']);
  expect(items[0].items[2]).toEqual({ label: 'Past runs', items: [{ autogenerate: { directory: ARCHIVE_SLUG } }] });
  expect(items[1].items.map((i) => i.slug)).toEqual([
    'benchmarks/jev',
    'benchmarks/jev/results',
    'benchmarks/jev/results-segment-ids',
    'benchmarks/jev/parse-and-moderation',
    'benchmarks/jev/audit-2026-09-19',
  ]);
  expect(items[2]).toEqual({ slug: 'benchmarks/cues', label: 'Cue benchmark' });
});
