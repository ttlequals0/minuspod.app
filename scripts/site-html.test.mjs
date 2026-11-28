import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { DEFAULT_PAIR } from '../shared/theme/config.mjs';
import { INDEXNOW_KEY } from './indexnow.mjs';

function page(path) {
  const file = new URL(path, import.meta.url);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  if (process.env.CI) throw new Error(`${path} missing: run the build before npm test`);
  return null;
}

const html = page('../landing/dist/index.html');
const docsHtml = page('../docs/dist/index.html');
const defaultPressed = new RegExp(`data-theme-pair="${DEFAULT_PAIR}"[^>]*aria-pressed="true"`);

describe.skipIf(!html)('landing built html (build landing first)', () => {
  test('landing header renders the theme picker with the default pair pressed', () => {
    expect(html).toContain('<details class="theme-pair">');
    expect(html).toContain('Same themes as the MinusPod app');
    expect(html).toMatch(defaultPressed);
    expect(html).toContain('class="theme-group-title"');
    expect(html).toContain('data-theme-mode aria-label="Toggle theme"');
  });

  test('bootstrap script is inlined before the stylesheet', () => {
    const boot = html.indexOf('dataset.pair');
    const sheet = Math.min(...['<link rel="stylesheet"', '<style'].map((s) => html.indexOf(s)).filter((i) => i >= 0));
    expect(sheet).toBeLessThan(Infinity);
    expect(boot).toBeGreaterThan(-1);
    expect(boot).toBeLessThan(sheet);
  });

  test('logo switches on data-theme', () => {
    expect(html).toContain('class="logo-light"');
    expect(html).toContain('class="logo-dark"');
  });

  test('every landing image has alt text', () => {
    for (const p of ['../landing/dist/index.html', '../landing/dist/gallery/index.html', '../landing/dist/watch/demo/index.html']) {
      const imgs = page(p)?.match(/<img\b[^>]*>/g) ?? [];
      expect(imgs.length).toBeGreaterThan(0);
      expect(imgs.filter((t) => !/\balt="[^"]+"/.test(t))).toEqual([]);
    }
  });

  test('footer links the star and fork counts to the repository', () => {
    const link = html.match(/<a class="repo-stats" href="https:\/\/github.com\/ttlequals0\/MinusPod" aria-label="([^"]+)">/);
    expect(link).not.toBeNull();
    expect(link[1]).toMatch(/^MinusPod on GitHub(: \d[\d.]*K? stars, \d[\d.]*K? forks)?$/);
  });

  test('footer links the subreddit', () => {
    expect(html).toMatch(/<a class="icon-link" href="https:\/\/www\.reddit\.com\/r\/MinusPod\/" aria-label="r\/MinusPod on Reddit">\s*<svg[^>]*aria-hidden="true"/);
  });

  test('landing head carries the social and structured-data tags', () => {
    expect(html).toMatch(/<title>MinusPod: [^<]+<\/title>/);
    expect(html).toContain('<meta property="og:url" content="https://minuspod.app/">');
    expect(html).toContain('<meta property="og:site_name" content="MinusPod">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('<link rel="sitemap" type="application/xml" href="/sitemap.xml">');
    expect(html).toContain('<h1>Self-hosted ad removal for podcasts and YouTube</h1>');
    const ld = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    expect(ld).not.toBeNull();
    const graph = JSON.parse(ld[1])['@graph'];
    expect(graph.map((n) => n['@type'])).toEqual(['WebSite', 'Organization', 'SoftwareApplication', 'FAQPage']);
    expect(graph[1].sameAs).toContain('https://github.com/ttlequals0/MinusPod');
  });

  test('the home page carries the README sections with poster links and no player', () => {
    for (const h of ['Features', 'How it works', 'Requirements', 'Quick start']) expect(html).toMatch(new RegExp(`<h2 id="[^"]+">${h}</h2>`));
    expect(html).toMatch(/<a href="https:\/\/minuspod\.app\/watch\/how-it-works\/"><img src="https:\/\/minuspod\.app\/videos\/how-it-works-landscape\.jpg" alt="Play video: How it works"/);
    expect(html).toContain('href="https://docs.minuspod.app/how-it-works/"');
    expect(html).not.toMatch(/<video\b/);
    const twin = readFileSync(new URL('../landing/dist/index.md', import.meta.url), 'utf8');
    expect(twin).toContain('](https://minuspod.app/watch/how-it-works/)');
  });

  test('the home page FAQ is collapsed and its markup matches the visible text', () => {
    const items = [...html.matchAll(/<details>\s*<summary>([^<]+)<\/summary>\s*<p>([^<]+)<a href/g)];
    expect(items.length).toBeGreaterThan(0);
    expect(html).not.toMatch(/<details open/);
    expect(page('../landing/dist/gallery/index.html')).toContain('<a href="/#faq">FAQ</a>');
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'].find((n) => n['@type'] === 'FAQPage');
    expect(ld.mainEntity.map((e) => [e.name, e.acceptedAnswer.text])).toEqual(items.map((m) => [m[1], m[2].trim()]));
  });

  test('both sitemaps date their pages and both sites serve the IndexNow key', () => {
    for (const site of ['landing', 'docs']) {
      const read = (f) => readFileSync(new URL(`../${site}/dist/${f}`, import.meta.url), 'utf8');
      expect(read('sitemap.xml')).toMatch(/\/<\/loc><lastmod>\d{4}-\d\d-\d\d/);
      expect(read(`${INDEXNOW_KEY}.txt`)).toBe(INDEXNOW_KEY);
    }
  });

  test('a watch page serves one video with VideoObject markup and the gallery links it', () => {
    const watch = page('../landing/dist/watch/demo/index.html');
    const players = watch.match(/<video\b[^>]*>/g);
    expect(players).toHaveLength(1);
    expect(players[0]).toContain('src="/videos/minuspod-demo-landscape.mp4"');
    expect(players[0]).toContain('poster="/videos/demo-landscape.jpg"');
    expect(watch).toContain('<link rel="canonical" href="https://minuspod.app/watch/demo/">');
    expect(watch).toContain('<meta property="og:image" content="https://minuspod.app/videos/demo-landscape.jpg">');
    expect(watch).toContain('<meta property="og:type" content="video.other">');
    expect(watch).toContain('<meta property="og:video" content="https://minuspod.app/videos/minuspod-demo-landscape.mp4">');
    expect(html).toContain('<meta property="og:type" content="website">');
    const ld = JSON.parse(watch.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    expect(ld).toMatchObject({
      '@type': 'VideoObject',
      thumbnailUrl: 'https://minuspod.app/videos/demo-landscape.jpg',
      contentUrl: 'https://minuspod.app/videos/minuspod-demo-landscape.mp4',
    });
    expect(ld.name).toBeTruthy();
    expect(ld.description).toBeTruthy();
    expect(ld.duration).toMatch(/^PT\d+S$/);
    expect(Date.parse(ld.uploadDate)).not.toBeNaN();
    expect(page('../landing/dist/gallery/index.html')).toContain('href="/watch/demo/"');
  });
});

describe.skipIf(!docsHtml)('docs built html (build docs first)', () => {
  test('a docs page serves a poster link to the watch page and no player', () => {
    const doc = page('../docs/dist/how-it-works/index.html');
    expect(doc).toContain('<a href="https://minuspod.app/watch/how-it-works/" data-video="https://minuspod.app/videos/minuspod-how-it-works-landscape.mp4"');
    expect(doc).not.toContain('<video');
  });

  test('docs header renders the shared picker', () => {
    expect(docsHtml).toContain('Same themes as the MinusPod app');
    expect(docsHtml).toMatch(defaultPressed);
    expect(docsHtml).toContain('data-theme-mode aria-label="Toggle theme"');
  });

  test('docs renders the picker in header and mobile menu', () => {
    expect(docsHtml.match(/<details class="theme-pair">/g)).toHaveLength(2);
  });

  test('docs sidebar opens only the group holding the current page', () => {
    expect(docsHtml.match(/<details[^>]*\bopen\b/g)).toHaveLength(1);
    expect(docsHtml.match(/<details[^>]*class="astro-/g).length).toBeGreaterThan(5);
  });

  test('docs logo links to the landing page and names the site', () => {
    expect(docsHtml).toContain('<a href="https://minuspod.app/" class="site-title');
    expect(docsHtml).toContain('alt="MinusPod"');
  });

  test('docs inline Starlight theme provider is replaced', () => {
    expect(docsHtml).toContain('dataset.pair');
    expect(docsHtml).not.toContain('starlight-theme');
  });

  test('no docs title tag is longer than 70 characters', () => {
    const pages = readdirSync(new URL('../docs/dist/', import.meta.url), { recursive: true }).filter((p) => p.endsWith('index.html'));
    // the built title is entity-encoded; measure the text a browser shows
    const entities = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
    const decode = (t) => t.replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => entities[e]);
    const long = pages
      .map((p) => [p, decode(/<title>([^<]*)<\/title>/.exec(page(`../docs/dist/${p}`))?.[1] ?? '')])
      .filter(([, t]) => t.length > 70);
    expect(pages.length).toBeGreaterThan(50);
    expect(long).toEqual([]);
  });

  test('docs pages carry a social image for the large card', () => {
    expect(docsHtml).toContain('name="twitter:card" content="summary_large_image"');
    expect(docsHtml).toContain('property="og:image" content="https://minuspod.app/videos/demo-landscape.jpg"');
  });
});
