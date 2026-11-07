import { test, expect } from 'vitest';
import { rewriteLink, transformMarkdown } from './prepare-docs.mjs';
import { videoIndex } from './lib/videos.mjs';

test.each([
  ['installation.md#memory-requirements', 'README.md', '/installation/#memory-requirements'],
  ['README.md', 'installation.md', '/'],
  ['specs/README.md', 'README.md', '/specs/'],
  ['../web-interface.md#held-for-review', 'videos/README.md', '/web-interface/#held-for-review'],
  ['../../README.md', 'videos/README.md', 'https://github.com/ttlequals0/MinusPod#readme'],
  ['../README.md', 'installation.md', 'https://github.com/ttlequals0/MinusPod#readme'],
  ['../openapi.yaml', 'api-and-webhooks.md', 'https://demo.minuspod.app/api-docs/'],
  ['../src/config.py', 'installation.md', 'https://github.com/ttlequals0/MinusPod/blob/main/src/config.py'],
  ['../benchmarks/llm/', 'llm-providers.md', 'https://github.com/ttlequals0/MinusPod/tree/main/benchmarks/llm/'],
  ['images/wf-overview-dark.svg', 'workflows.md', '/images/wf-overview-dark.svg'],
  ['schemas/episode-sidecar.schema.json', 'local-feeds.md', '/schemas/episode-sidecar.schema.json'],
  ['DEPLOYMENT.md', 'README.md', '/deployment/'],
  ['#anchor', 'x.md', '#anchor'],
  ['https://openrouter.ai', 'x.md', 'https://openrouter.ai'],
])('rewriteLink(%s from %s)', (href, from, expected) => {
  expect(rewriteLink(href, from)).toBe(expected);
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

test('rewrites picture sources and markdown images', () => {
  const src = '# W\n\n<picture>\n<source media="(prefers-color-scheme: dark)" srcset="images/wf-overview-dark.svg">\n<img alt="o" src="images/wf-overview-light.svg">\n</picture>\n\n![badge](screenshots/cover-art-badge.png)\n';
  const { body } = transformMarkdown(src, 'workflows.md');
  expect(body).toContain('srcset="/images/wf-overview-dark.svg"');
  expect(body).toContain('src="/images/wf-overview-light.svg"');
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
