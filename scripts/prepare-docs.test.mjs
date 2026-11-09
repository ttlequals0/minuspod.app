import { test, expect, vi } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BENCHMARK_PAGES } from '../shared/benchmark-pages.mjs';
import { archiveDates, archiveIndex, archivePages, listMarkdown, renderPage, rewriteLink, shortTitle, transformMarkdown } from './prepare-docs.mjs';
import { parseVideoTable, videoIndex } from './lib/videos.mjs';
import { headingSlug, mapSrcset } from './lib/md.mjs';

test.each([
  ['installation.md#memory-requirements', 'README.md', '/installation/#memory-requirements'],
  ['README.md', 'installation.md', '/'],
  ['specs/README.md', 'README.md', '/specs/'],
  ['../web-interface.md#held-for-review', 'videos/README.md', '/web-interface/#held-for-review'],
  ['../../README.md', 'videos/README.md', 'https://github.com/ttlequals0/MinusPod#readme'],
  ['../README.md', 'installation.md', 'https://github.com/ttlequals0/MinusPod#readme'],
  ['../openapi.yaml', 'api-and-webhooks.md', '/api/'],
  ['../openapi.yaml#/components/schemas/FeedSummary', 'api-and-webhooks.md', '/api/schemas/#feedsummary'],
  ['../openapi.yaml#/paths/~1feeds', 'api-and-webhooks.md', '/api/'],
  ['../src/config.py', 'installation.md', 'https://github.com/ttlequals0/MinusPod/blob/main/src/config.py'],
  ['images/wf-overview-dark.svg', 'workflows.md', '/images/wf-overview-dark.svg'],
  ['schemas/episode-sidecar.schema.json', 'local-feeds.md', '/schemas/episode-sidecar.schema.json'],
  ['DEPLOYMENT.md', 'README.md', '/deployment/'],
  ['minuspod-demo.mp4', 'videos/README.md', 'https://minuspod.app/videos/minuspod-demo.mp4'],
  ['render.mjs', 'videos/README.md', 'https://github.com/ttlequals0/MinusPod/blob/main/docs/videos/render.mjs'],
  ['#anchor', 'x.md', '#anchor'],
  ['https://openrouter.ai', 'x.md', 'https://openrouter.ai'],
])('rewriteLink(%s from %s)', (href, from, expected) => {
  expect(rewriteLink(href, from)).toBe(expected);
});

test('a long title keeps its first clause as the tab title, a short one is left alone', () => {
  expect(shortTitle('Installation')).toBeNull();
  expect(shortTitle('Spec: End-of-episode ad fixes + audio splice-evidence signals + cross-fetch differential')).toBe('End-of-episode ad fixes | MinusPod');
  expect(shortTitle('Detection tuning: actionable pass-2 misses, scoped rejections, label hygiene (2.76.0)')).toBe('Detection tuning | MinusPod');
  expect(shortTitle('Formal release process and in-app update checks (issue #567)')).toBe('Formal release process and in-app update checks | MinusPod');
  expect(shortTitle('Design: split src/main_app/processing.py by pipeline stage, then the tests')).toBe('Split src/main_app/processing.py by pipeline stage | MinusPod');
  expect(shortTitle('A very long first clause without any separator that keeps going on and on past the limit')).toBeNull();
  expect(shortTitle('Plan: shard the detection queue across workers and retire the legacy path')).toBeNull();
  expect(shortTitle('Fast, deterministic sponsor matching across episodes with cached transcripts and verdicts')).toBeNull();
});

test('renderPage writes a head title only when the page title is long', () => {
  const short = renderPage({ frontmatter: { title: 'Installation', description: 'd' }, body: 'x' });
  expect(short).not.toContain('head:');
  const page = renderPage({ frontmatter: { title: 'Cue play UX, content-transition prompt fix, pairing parity, threshold auto-suggest', description: 'd' }, body: 'x' });
  expect(page).toContain('head:\n  - tag: title\n    content: "Cue play UX | MinusPod"');
});

test('frontmatter skips the nav line and strips the H1', () => {
  const src = '# Installation\n\n[< Docs index](README.md) | [Project README](../README.md)\n\nHow to install [MinusPod](../README.md) on a host.\n\n## Requirements\n';
  const { frontmatter, body } = transformMarkdown(src, 'installation.md');
  expect(frontmatter.title).toBe('Installation');
  expect(frontmatter.description).toBe('How to install MinusPod on a host.');
  expect(body).not.toMatch(/^# Installation/m);
  expect(body).not.toContain('[< Docs index]');
  expect(body).toContain('## Requirements');
});

test('splits a color-scheme picture into two themed images and rewrites markdown images', () => {
  const src = '# W\n\n<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="images/wf-overview-dark.svg">\n  <img alt="o" src="images/wf-overview-light.svg">\n</picture>\n\n![badge](screenshots/cover-art-badge.png)\n';
  const { body } = transformMarkdown(src, 'workflows.md');
  expect(body).toContain('<img alt="o" src="/images/wf-overview-light.svg" class="dark:sl-hidden">\n<img alt="o" src="/images/wf-overview-dark.svg" class="light:sl-hidden">');
  expect(body).not.toContain('<picture');
  expect(body).not.toContain('<source');
  expect(body).toContain('![badge](/screenshots/cover-art-badge.png)');
});

const videosReadme = '# Videos\n\n| Video | Portrait | Landscape | Length | What it shows |\n|---|---|---|---|---|\n| UI tour | [a](minuspod-demo.mp4) | [b](minuspod-demo-landscape.mp4) | 108 s | Dashboard and [more](../web-interface.md). |\n| How it works | [a](minuspod-how-it-works.mp4) | [b](minuspod-how-it-works-landscape.mp4) | 107 s | One episode. |\n| Review queue | [a](minuspod-review-queue.mp4) | [b](minuspod-review-queue-landscape.mp4) | 30 s | A held detection. |\n\n## Embedding in the docs\n\n| Video | Embedded in |\n|---|---|\n| UI tour | [Project README](../../README.md), [Web Interface](../web-interface.md) |\n| How it works | [How It Works](../how-it-works.md) |\n| Review queue | [Web Interface, Held for Review](../web-interface.md#held-for-review) |\n';

test('videoIndex joins the two tables and drops targets outside docs', () => {
  expect(videoIndex(videosReadme)).toEqual([
    { name: 'demo', targets: [{ file: 'web-interface.md', fragment: null }] },
    { name: 'how-it-works', targets: [{ file: 'how-it-works.md', fragment: null }] },
    { name: 'review-queue', targets: [{ file: 'web-interface.md', fragment: 'held-for-review' }] },
  ]);
});

test('replaces a bare user-attachments line with a video element', () => {
  const src = '# H\n\nIntro.\n\nhttps://github.com/user-attachments/assets/cf3d38d7-3df6-4e8d-bac1-c5dd720dc4b6\n';
  const { body } = transformMarkdown(src, 'how-it-works.md', videoIndex(videosReadme));
  expect(body).toContain('<video controls preload="none" playsinline poster="https://minuspod.app/videos/how-it-works-landscape.jpg" src="https://minuspod.app/videos/minuspod-how-it-works-landscape.mp4"></video>');
});

test('picks the video by section when a file embeds two', () => {
  const src = '# Web Interface\n\n## Contents\n\nhttps://github.com/user-attachments/assets/2078724e-ca79-4368-a901-3817f9a0d213\n\n### Held for Review\n\nhttps://github.com/user-attachments/assets/f6eb6291-5143-47cd-8d48-f7629e7043a2\n';
  const { body } = transformMarkdown(src, 'web-interface.md', videoIndex(videosReadme));
  expect(body).toContain('minuspod-demo-landscape.mp4');
  expect(body).toContain('minuspod-review-queue-landscape.mp4');
  expect(body).not.toContain('user-attachments');
});

test('removes the rule next to a nav line and sets the slug', () => {
  const src = '# Deployment\n\n[< Docs index](README.md) | [Project README](../README.md)\n\n---\n\nBody.\n\n---\n\n[< Docs index](README.md) | [Project README](../README.md)\n';
  const { frontmatter, body } = transformMarkdown(src, 'DEPLOYMENT.md');
  expect(frontmatter.slug).toBe('deployment');
  expect(body.trim()).toBe('Body.');
});

test('leaves fenced code untouched', () => {
  const src = '# H\n\nx\n\n```bash\ncat [a](../README.md)\n```\n';
  const { body } = transformMarkdown(src, 'x.md');
  expect(body).toContain('cat [a](../README.md)');
});

test('keeps underscores in code spans and snake_case words', () => {
  const src = '# T `A_B_C`\n\nUse `MAX_RETRY_COUNT` and snake_case_name with _emphasis_ here.\n';
  const { frontmatter } = transformMarkdown(src, 'x.md');
  expect(frontmatter.title).toBe('T A_B_C');
  expect(frontmatter.description).toBe('Use MAX_RETRY_COUNT and snake_case_name with emphasis here.');
});

test('rewrites the target of a link wrapping an image', () => {
  const { body } = transformMarkdown('# H\n\n[![x](images/a.png)](installation.md)\n', 'README.md');
  expect(body).toContain('[![x](/images/a.png)](/installation/)');
});

test('rewrites every srcset candidate and keeps descriptors', () => {
  const { body } = transformMarkdown('# H\n\n<img srcset="images/a.svg 1x, images/b.svg 2x">\n', 'x.md');
  expect(body).toContain('srcset="/images/a.svg 1x, /images/b.svg 2x"');
});

test('drops a Contents section made only of same-page links', () => {
  const src = '# T\n\nIntro.\n\n## Contents\n\n- [x](#x)\n- [y](#y)\n- [z](#z)\n\n## Next\n\nBody.\n';
  const { body } = transformMarkdown(src, 'installation.md');
  expect(body).not.toContain('Contents');
  expect(body).not.toContain('(#x)');
  expect(body).toContain('## Next');
});

test('keeps a Contents section that opens with other content', () => {
  const src = '# T\n\nIntro.\n\n## Contents\n\nSee below.\n\n- [x](#x)\n\n## Next\n\nBody.\n';
  const { body } = transformMarkdown(src, 'installation.md');
  expect(body).toContain('## Contents');
  expect(body).toContain('See below.');
  expect(body).toContain('(#x)');
});

test('drops the link list but keeps prose that follows it', () => {
  const src = '# T\n\n## Contents\n\n- [x](#x)\n\nIntro prose.\n\n## Next\n';
  const { body } = transformMarkdown(src, 'installation.md');
  expect(body).not.toContain('Contents');
  expect(body).toContain('Intro prose.');
});

test('keeps a Contents section made of cross-page links', () => {
  const src = '# T\n\nIntro.\n\n## Contents\n\n- [Install](installation.md)\n- [Held](web-interface.md#held-for-review)\n\n## Next\n';
  const { body } = transformMarkdown(src, 'README.md');
  expect(body).toContain('## Contents');
  expect(body).toContain('[Install](/installation/)');
  expect(body).toContain('[Held](/web-interface/#held-for-review)');
});

test('throws on a video line with no matching table row', () => {
  const src = '# H\n\nhttps://github.com/user-attachments/assets/0000-unknown\n';
  expect(() => transformMarkdown(src, 'glossary.md', videoIndex(videosReadme))).toThrow(/glossary\.md.*0000-unknown/);
});

test('labels the specs index as the sidebar overview', () => {
  const page = transformMarkdown('# Specs\n\nAll specs.\n', 'specs/README.md');
  expect(renderPage(page, 'specs/index.md')).toBe('---\ntitle: "Specs"\ndescription: "All specs."\nslug: specs\nsidebar:\n  label: "Overview"\n  order: 0\n---\n\nAll specs.\n');
  expect(renderPage(transformMarkdown('# A\n\nB.\n', 'specs/a.md'), 'specs/a.md')).not.toContain('sidebar:');
});

test('mapSrcset ignores a trailing empty candidate', () => {
  expect(mapSrcset('a.svg 1x, b.svg 2x,', (u) => `/${u}`)).toBe('/a.svg 1x, /b.svg 2x');
});

test('parseVideoTable drops a trailing note that ends with a repository path', () => {
  const readme = '| Video | Portrait | Landscape | Length | What it shows |\n|---|---|---|---|---|\n| Processing modes | [a](minuspod-processing-modes.mp4) | [b](minuspod-processing-modes-landscape.mp4) | 73 s | One episode under each of the five modes, then segment categories and the remove, beep, keep and mark actions. Animated, source in [processing-modes/](processing-modes/). |\n';
  expect(parseVideoTable(readme)[0].description).toBe('One episode under each of the five modes, then segment categories and the remove, beep, keep and mark actions.');
});

test('listMarkdown skips node_modules and video source dirs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'docs-'));
  mkdirSync(join(dir, 'guides/node_modules/pkg'), { recursive: true });
  mkdirSync(join(dir, 'videos/x'), { recursive: true });
  writeFileSync(join(dir, 'guides/node_modules/pkg/README.md'), '# pkg\n');
  writeFileSync(join(dir, 'guides/setup.md'), '# s\n');
  writeFileSync(join(dir, 'videos/x/README.md'), '# x\n');
  writeFileSync(join(dir, 'videos/README.md'), '# v\n');
  expect(listMarkdown(dir).sort()).toEqual(['guides/setup.md', 'videos/README.md']);
});

test('headingSlug keeps underscores', () => {
  expect(headingSlug('The `MAX_RETRY_COUNT` setting')).toBe('the-max_retry_count-setting');
});

test('throws when a video target fragment matches no heading', () => {
  const src = '# Web Interface\n\n## Other\n\nText.\n';
  expect(() => transformMarkdown(src, 'web-interface.md', videoIndex(videosReadme))).toThrow('Video target web-interface.md#held-for-review has no matching heading');
});

test('renderPage writes sidebar and table of contents frontmatter when a page carries them', () => {
  const out = renderPage({ frontmatter: { title: 'T', description: 'D', sidebar: { order: 2, label: 'Two' }, tableOfContents: true }, body: 'x\n' }, 'api/t.md');
  expect(out).toBe('---\ntitle: "T"\ndescription: "D"\nsidebar:\n  order: 2\n  label: "Two"\ntableOfContents:\n  minHeadingLevel: 2\n  maxHeadingLevel: 2\n---\n\nx\n');
  expect(renderPage({ frontmatter: { title: 'S', description: '' }, body: 'y' }, 'specs/index.md')).toContain('sidebar:\n  label: "Overview"\n  order: 0\n');
});

test('frontmatter skips a spec metadata paragraph', () => {
  const src = '# Review Queue\n\nDate: 2026-07-12\nStatus: implemented in 2.44.0\n\nRejected detections wait in a review area.\n';
  expect(transformMarkdown(src, 'specs/review-queue.md').frontmatter.description).toBe('Rejected detections wait in a review area.');
});

const bench = (repo, slug, extra = {}) => ({ repo, base: '', slug, pages: BENCHMARK_PAGES, assets: new Map(), ...extra });

test.each([
  ['report_assets/pareto.svg', 'benchmarks/llm/results/report.md', 'main', '/benchmarks/llm/results/report_assets/pareto.svg'],
  ['../README.md', 'benchmarks/llm/data/README.md', 'main', '/benchmarks/llm/'],
  ['data/README.md#format', 'benchmarks/llm/CONTRIBUTING.md', 'main', '/benchmarks/llm/data/#format'],
  ['../../docs/llm-providers.md', 'benchmarks/llm/README.md', 'main', '/llm-providers/'],
  ['../../src/utils/constants.py', 'benchmarks/llm/README.md', 'main', 'https://github.com/ttlequals0/MinusPod/blob/main/src/utils/constants.py'],
  ['report_assets/pareto.svg', 'benchmark/results/report-combined.md', 'jev', '/benchmarks/jev/results/report_assets/pareto.svg'],
  ['../results/raw/', 'benchmark/results/report-combined.md', 'jev', 'https://github.com/ttlequals0/MinusPodJev/tree/main/benchmark/results/raw/'],
  ['#tldr', 'benchmark/results/report-combined.md', 'jev', '#tldr'],
])('rewriteLink(%s from %s in %s)', (href, from, repo, expected) => {
  expect(rewriteLink(href, from, bench(repo))).toBe(expected);
});

test('benchmark pages drop a Table of Contents and take the configured slug', () => {
  const src = '# Report\n\n## Table of Contents\n\n- [Key](#key)\n- [Results](#results)\n\n## Key\n\nMetric notes.\n';
  const page = transformMarkdown(src, 'benchmarks/llm/results/report.md', [], bench('main', 'benchmarks/llm/results'));
  expect(page.frontmatter.slug).toBe('benchmarks/llm/results');
  expect(page.body).not.toContain('Table of Contents');
  expect(page.body).toContain('## Key');
});

test('archive reports get dated slugs and an index page', () => {
  const pages = { main: { ...BENCHMARK_PAGES.main, ...archivePages(['2026-08-23', '2026-05-16']) }, jev: BENCHMARK_PAGES.jev };
  expect(pages.main['benchmarks/llm/results/archive/2026-08-23/report.md']).toEqual({
    slug: 'benchmarks/llm/archive/2026-08-23',
    title: 'LLM benchmark results, 2026-08-23',
    description: 'The LLM benchmark run of 2026-08-23: accuracy, cost, latency and JSON compliance per model.',
    long: true,
    sidebar: { label: '2026-08-23', order: 1 },
  });
  expect(rewriteLink('archive/2026-05-16/report.md', 'benchmarks/llm/results/report.md', bench('main', undefined, { pages }))).toBe('/benchmarks/llm/archive/2026-05-16/');
  // a docs page links into the archive and to a benchmark image: page on the site, image on GitHub
  const docs = { repo: 'main', base: 'docs', pages };
  expect(rewriteLink('../benchmarks/llm/results/archive/2026-05-16/report.md', 'llm-providers.md', docs)).toBe('/benchmarks/llm/archive/2026-05-16/');
  expect(rewriteLink('../benchmarks/llm/results/report_assets/pareto.svg', 'llm-providers.md', docs)).toBe('https://github.com/ttlequals0/MinusPod/blob/main/benchmarks/llm/results/report_assets/pareto.svg');
  const index = renderPage(archiveIndex(['2026-08-23', '2026-05-16']), 'benchmarks/llm/archive/index.md');
  expect(index).toContain('slug: benchmarks/llm/archive');
  expect(index).toContain('  label: "Overview"');
  expect(index).toContain('- [2026-08-23](/benchmarks/llm/archive/2026-08-23/)');
});

test('a docs page link to the benchmark directory lands on the benchmark page', () => {
  expect(rewriteLink('../benchmarks/llm/', 'llm-providers.md')).toBe('/benchmarks/llm/');
  expect(rewriteLink('../benchmarks/llm/results/report.md', 'llm-providers.md')).toBe('/benchmarks/llm/results/');
});

test('referenced images are collected for copying and a missing same-page anchor is unlinked', () => {
  const assets = new Map();
  const src = '# R\n\n## Key\n\nSee [Key](#key) and [Gone](#gone).\n\n![Chart](charts/pareto.png)\n';
  const page = transformMarkdown(src, 'benchmark/results/report.md', [], bench('jev', 'benchmarks/jev/results', { assets }));
  expect(page.body).toContain('[Key](#key) and Gone.');
  expect(page.body).toContain('![Chart](/benchmarks/jev/results/charts/pareto.png)');
  expect([...assets]).toEqual([['benchmark/results/charts/pareto.png', '/benchmarks/jev/results/charts/pareto.png']]);
});

test('a missing same-page anchor in raw HTML stays as written', () => {
  const page = transformMarkdown('# R\n\n<a href="#gone">Gone</a>\n', 'benchmark/README.md', [], bench('jev', 'benchmarks/jev'));
  expect(page.body).toContain('<a href="#gone">Gone</a>');
});

test('a link that climbs out of the repo becomes plain text and is reported', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const page = transformMarkdown('# R\n\nSee [`constants.py`](../../src/utils/constants.py).\n', 'benchmark/README.md', [], bench('jev', 'benchmarks/jev'));
  expect(page.body).toContain('See `constants.py`.');
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('leaves the repo'));
  warn.mockRestore();
});

test('a missing archive directory yields no dates', () => {
  expect(archiveDates('/nonexistent/archive')).toEqual([]);
});
