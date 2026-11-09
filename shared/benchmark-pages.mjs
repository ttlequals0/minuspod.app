// Benchmark pages published from outside docs/: repo path -> site slug, page title and sidebar
// label. prepare-docs renders them in this order and the docs sidebar lists them in this order.
export const BENCHMARK_PAGES = {
  main: {
    'benchmarks/llm/README.md': { slug: 'benchmarks/llm', title: 'LLM benchmark', label: 'Overview' },
    'benchmarks/llm/results/report.md': {
      slug: 'benchmarks/llm/results',
      title: 'LLM benchmark results',
      label: 'Results',
      description: 'Accuracy, cost, latency and JSON compliance of each model on the human-verified ad corpus, from the latest run.',
      long: true,
    },
    'benchmarks/llm/results/parse-and-moderation.md': { slug: 'benchmarks/llm/parse-and-moderation', title: 'LLM parsing and moderation', label: 'Parsing and moderation' },
    'benchmarks/llm/data/README.md': { slug: 'benchmarks/llm/data', title: 'LLM benchmark corpus', label: 'Corpus' },
    'benchmarks/llm/CONTRIBUTING.md': { slug: 'benchmarks/llm/contributing', title: 'Contributing to the LLM benchmark', label: 'Contributing' },
    'benchmarks/cues/README.md': { slug: 'benchmarks/cues', title: 'Cue benchmark', label: 'Cue benchmark' },
  },
  jev: {
    'benchmark/README.md': { slug: 'benchmarks/jev', title: 'Jev benchmark', label: 'Overview' },
    'benchmark/results/report-combined.md': {
      slug: 'benchmarks/jev/results',
      title: 'Jev benchmark results',
      label: 'Results',
      description: 'The Jev proxy against chat models on the same ad corpus: accuracy, cost, latency and JSON compliance, combined across addressing modes.',
      long: true,
    },
    'benchmark/results/report.md': {
      slug: 'benchmarks/jev/results-segment-ids',
      title: 'Jev results, segment IDs mode',
      label: 'Results, segment IDs mode',
      description: 'The Jev proxy run in segment IDs addressing mode: accuracy, cost, latency and JSON compliance per model.',
      long: true,
    },
    'benchmark/results/parse-and-moderation.md': { slug: 'benchmarks/jev/parse-and-moderation', title: 'Jev parsing and moderation', label: 'Parsing and moderation' },
    'benchmark/results/audit-2026-09-19.md': { slug: 'benchmarks/jev/audit-2026-09-19', title: 'Jev benchmark audit, 2026-09-19', label: 'Audit, 2026-09-19' },
  },
};

export const RESULTS_SLUG = BENCHMARK_PAGES.main['benchmarks/llm/results/report.md'].slug;

// Dated LLM reports live under this directory and are published at /benchmarks/llm/archive/<date>/.
export const ARCHIVE_DIR = 'benchmarks/llm/results/archive';
export const ARCHIVE_SLUG = 'benchmarks/llm/archive';

// The Benchmarks sidebar group, one subgroup per benchmark in table order. The dated LLM runs
// follow the current results.
export function benchmarkSidebar() {
  const entry = ({ slug, label }) => ({ slug, label });
  const under = (repo, prefix) => Object.values(BENCHMARK_PAGES[repo]).filter((p) => p.slug.startsWith(prefix)).map(entry);
  const llm = under('main', 'benchmarks/llm');
  llm.splice(llm.findIndex((i) => i.slug === RESULTS_SLUG) + 1, 0, { label: 'Past runs', items: [{ autogenerate: { directory: ARCHIVE_SLUG } }] });
  return {
    label: 'Benchmarks',
    items: [
      { label: 'LLM benchmark', items: llm },
      { label: 'Jev benchmark', items: under('jev', 'benchmarks/jev') },
      ...under('main', 'benchmarks/cues'),
    ],
  };
}
