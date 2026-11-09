import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { DEFAULT_PAIR } from '../shared/theme/config.mjs';

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
    for (const p of ['../landing/dist/index.html', '../landing/dist/gallery/index.html']) {
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

  test('landing head carries the social and structured-data tags', () => {
    expect(html).toMatch(/<title>MinusPod: [^<]+<\/title>/);
    expect(html).toContain('<meta property="og:url" content="https://minuspod.app/">');
    expect(html).toContain('<meta property="og:site_name" content="MinusPod">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('<link rel="sitemap" type="application/xml" href="/sitemap.xml">');
    expect(html).toMatch(/<h1>\s*<img class="logo-light" src="\/brand\/logo.svg" alt="MinusPod"/);
    const ld = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
    expect(ld).not.toBeNull();
    expect(JSON.parse(ld[1])['@type']).toBe('SoftwareApplication');
  });
});

describe.skipIf(!docsHtml)('docs built html (build docs first)', () => {
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
