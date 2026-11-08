import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { isMain, resetDir } from './lib/cli.mjs';
import { jevDir, mainDir, repoRoot } from './lib/main-dir.mjs';
import { ATTR_RE, LINK_RE, fenceMask, firstH1, firstParagraph, headingSlug, isExternalHref, isNavLine, mapSrcset, describeText } from './lib/md.mjs';
import { videoIndex } from './lib/videos.mjs';
import { apiPages } from './lib/openapi-md.mjs';
import { parse as parseYaml } from 'yaml';

const GH = 'https://github.com/ttlequals0/MinusPod';
const GH_JEV = 'https://github.com/ttlequals0/MinusPodJev';
const STATIC_DIRS = ['images', 'screenshots', 'schemas', 'examples'];
// Sidebar frontmatter by output path relative to the docs content dir.
const SIDEBAR_OVERRIDES = { 'specs/index.md': { label: 'Overview', order: 0 } };
const VIDEO_LINE = /^https:\/\/github\.com\/user-attachments\/assets\/([\w-]+)$/;
const THEMED_PICTURE = /<picture>\s*<source\b([^>]*)>\s*<img\b([^>]*?)\s*\/?>\s*<\/picture>/g;

// Lowercased page path without .md; a trailing README names its directory.
const pageKey = (rel) => rel.slice(0, -3).toLowerCase().replace(/(^|\/)readme$/, '');

// Where a page comes from: the repo, the directory its relative path is under, and its slug
// when it does not follow from the path. Docs pages are the default.
const DOCS = { repo: 'main', base: 'docs' };
const REPOS = {
  main: { gh: GH, assetRoot: 'benchmarks/', publicRoot: '/benchmarks/' },
  jev: { gh: GH_JEV, assetRoot: 'benchmark/', publicRoot: '/benchmarks/jev/' },
};
// Benchmark pages pulled from outside docs/, by repo path. Archive reports are added at run time.
export const BENCHMARK_PAGES = {
  main: {
    'benchmarks/llm/README.md': { slug: 'benchmarks/llm', title: 'LLM benchmark' },
    'benchmarks/llm/results/report.md': {
      slug: 'benchmarks/llm/results',
      title: 'LLM benchmark results',
      description: 'Accuracy, cost, latency and JSON compliance of each model on the human-verified ad corpus, from the latest run.',
      long: true,
    },
    'benchmarks/llm/results/parse-and-moderation.md': { slug: 'benchmarks/llm/parse-and-moderation', title: 'LLM parsing and moderation' },
    'benchmarks/llm/data/README.md': { slug: 'benchmarks/llm/data', title: 'LLM benchmark corpus' },
    'benchmarks/llm/CONTRIBUTING.md': { slug: 'benchmarks/llm/contributing', title: 'Contributing to the LLM benchmark' },
    'benchmarks/cues/README.md': { slug: 'benchmarks/cues', title: 'Cue benchmark' },
  },
  jev: {
    'benchmark/README.md': { slug: 'benchmarks/jev', title: 'Jev benchmark' },
    'benchmark/results/report-combined.md': {
      slug: 'benchmarks/jev/results',
      title: 'Jev benchmark results',
      description: 'The Jev proxy against chat models on the same ad corpus: accuracy, cost, latency and JSON compliance, combined across addressing modes.',
      long: true,
    },
    'benchmark/results/report.md': { slug: 'benchmarks/jev/results-segment-ids', title: 'Jev results, segment IDs mode', long: true },
    'benchmark/results/parse-and-moderation.md': { slug: 'benchmarks/jev/parse-and-moderation', title: 'Jev parsing and moderation' },
    'benchmark/results/audit-2026-09-19.md': { slug: 'benchmarks/jev/audit-2026-09-19', title: 'Jev benchmark audit, 2026-09-19' },
  },
};
const REPORT_ASSET = /\/report_assets\/[^/]+\.(svg|png)$/;
const ARCHIVE = 'benchmarks/llm/results/archive';

// Dated report directories under results/archive, newest first.
export const archiveDates = (dir) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'report.md')))
    .map((e) => e.name)
    .sort()
    .reverse();

export function addArchivePages(dates) {
  dates.forEach((date, i) => {
    BENCHMARK_PAGES.main[`${ARCHIVE}/${date}/report.md`] = {
      slug: `benchmarks/llm/archive/${date}`,
      title: `LLM benchmark results, ${date}`,
      long: true,
      sidebar: { label: date, order: i + 1 },
    };
  });
}

export const archiveIndex = (dates) => ({
  frontmatter: {
    title: 'Past LLM benchmark runs',
    description: 'Earlier runs of the LLM benchmark, newest first. The current run is on the results page.',
    slug: 'benchmarks/llm/archive',
    sidebar: { label: 'Overview', order: 0 },
  },
  body: `Earlier runs of the LLM benchmark, newest first. The current run is on the [results page](/benchmarks/llm/results/).\n\n${dates.map((d) => `- [${d}](/benchmarks/llm/archive/${d}/)`).join('\n')}\n`,
});

// Public path of a report asset directory, relative to docs/public.
const publicAssetDir = (repo, repoDir) => `${REPOS[repo].publicRoot}${repoDir.slice(REPOS[repo].assetRoot.length)}`.slice(1);

export function rewriteLink(href, fromRel, source = DOCS) {
  if (isExternalHref(href) || href.startsWith('#')) return href;
  const hash = href.indexOf('#');
  const path = hash === -1 ? href : href.slice(0, hash);
  const fragment = hash === -1 ? '' : href.slice(hash);
  if (!path) return href;
  const repoPath = posix.normalize(posix.join(source.base, posix.dirname(fromRel), path));
  const { gh, assetRoot, publicRoot } = REPOS[source.repo];

  const page = BENCHMARK_PAGES[source.repo][repoPath];
  if (page) return `/${page.slug}/${fragment}`;
  if (REPORT_ASSET.test(repoPath) && repoPath.startsWith(assetRoot)) return `${publicRoot}${repoPath.slice(assetRoot.length)}${fragment}`;
  if (source.repo !== 'main') return `${gh}/${repoPath.endsWith('/') ? 'tree' : 'blob'}/main/${repoPath}${fragment}`;

  if (repoPath.startsWith('docs/')) {
    const rel = repoPath.slice('docs/'.length);
    if (rel.endsWith('.md')) {
      const key = pageKey(rel);
      return `/${key ? `${key}/` : ''}${fragment}`;
    }
    if (STATIC_DIRS.includes(rel.split('/')[0])) return `/${rel}${fragment}`;
    if (/^videos\/[^/]+\.mp4$/.test(rel)) return `https://minuspod.app/${rel}`;
  } else if (repoPath === 'README.md') {
    return `${GH}#readme`;
  } else if (repoPath === 'openapi.yaml') {
    // the spec is rendered as the API reference; a schema pointer lands on its heading
    const schema = /^#\/components\/schemas\/([^/]+)$/.exec(fragment);
    return schema ? `/api/schemas/#${headingSlug(schema[1])}` : '/api/';
  }
  return `${GH}/${repoPath.endsWith('/') ? 'tree' : 'blob'}/main/${repoPath}${fragment}`;
}

function pickVideo(videos, fromRel, headingSlugNow) {
  const hits = videos
    .map((v) => ({ v, targets: v.targets.filter((t) => t.file === fromRel) }))
    .filter((h) => h.targets.length);
  if (hits.length <= 1) return hits[0]?.v;
  const bySection = hits.find((h) => h.targets.some((t) => t.fragment === headingSlugNow));
  return (bySection ?? hits.find((h) => h.targets.some((t) => t.fragment === null)))?.v;
}

const videoElement = (name) =>
  `<video controls preload="none" playsinline poster="https://minuspod.app/videos/${name}-landscape.jpg" src="https://minuspod.app/videos/minuspod-${name}-landscape.mp4"></video>`;

const rewriteLinks = (text, fromRel, source) =>
  text.replace(
    LINK_RE,
    (m, bang, label, href, title = '') =>
      `${bang}[${rewriteLinks(label, fromRel, source)}](${rewriteLink(href, fromRel, source)}${title})`,
  );

const rewriteAttrs = (text, fromRel, source) =>
  text.replace(ATTR_RE, (m, attr, val) => {
    const next = attr === 'srcset' ? mapSrcset(val, (u) => rewriteLink(u, fromRel, source)) : rewriteLink(val, fromRel, source);
    return `${attr}="${next}"`;
  });

// Starlight's theme picker sets data-theme, which a prefers-color-scheme source ignores.
const splitThemedPictures = (text) =>
  text.replace(THEMED_PICTURE, (m, source, img) => {
    const dark = /\bsrcset="([^"]+)"/.exec(source);
    if (!/media="\(prefers-color-scheme:\s*dark\)"/.test(source) || !dark) return m;
    const alt = /\balt="[^"]*"/.exec(img)?.[0] ?? 'alt=""';
    const light = /\bclass="/.test(img) ? img.replace(/\bclass="/, 'class="dark:sl-hidden ') : `${img} class="dark:sl-hidden"`;
    return `<img${light}>\n<img ${alt} src="${dark[1]}" class="light:sl-hidden">`;
  });

const rewriteRun = (text, fromRel, source) => rewriteAttrs(rewriteLinks(splitThemedPictures(text), fromRel, source), fromRel, source);

export function transformMarkdown(src, fromRel, videos = [], source = DOCS) {
  const lines = src.split('\n');
  const fenced = fenceMask(lines);
  const h1 = firstH1(lines, fenced);
  const drop = new Set();
  if (h1) drop.add(h1.index);

  const navs = lines.flatMap((l, i) => (!fenced[i] && isNavLine(l) ? [i] : []));
  const adjacentRule = (i, step) => {
    let j = i + step;
    while (j >= 0 && j < lines.length && lines[j].trim() === '') j += step;
    return j >= 0 && j < lines.length && !fenced[j] && lines[j].trim() === '---' ? [j] : [];
  };
  for (const i of navs) {
    drop.add(i);
    for (const j of [...adjacentRule(i, 1), ...adjacentRule(i, -1)]) drop.add(j);
  }

  const isTocItem = (l) => {
    if (!/^\s*[-*]\s/.test(l)) return false;
    const targets = [...l.matchAll(/\]\(([^)]*)\)/g)].map((m) => m[1]);
    return targets.length > 0 && targets.every((t) => t.startsWith('#'));
  };
  lines.forEach((l, i) => {
    if (fenced[i] || !/^##\s+(Contents|Table of Contents)\s*$/.test(l) || drop.has(i)) return;
    let end = i + 1;
    while (end < lines.length && !(!fenced[end] && /^#{1,6}\s/.test(lines[end])) && (!lines[end].trim() || (!fenced[end] && isTocItem(lines[end])))) end++;
    if (lines.slice(i + 1, end).some((l) => l.trim())) {
      for (let j = i; j < end; j++) drop.add(j);
    }
  });

  const body = lines.flatMap((text, i) => (drop.has(i) ? [] : [{ text, fenced: fenced[i] }]));

  const description = describeText(firstParagraph(body.map((l) => l.text), body.map((l) => l.fenced)));
  const frontmatter = { title: h1?.text ?? '', description };
  const slug = source.slug ?? pageKey(fromRel);
  if (slug) frontmatter.slug = slug;

  let heading = '';
  const slugs = new Set();
  const out = body.map(({ text: line, fenced: isFenced }) => {
    if (isFenced) return line;
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) {
      heading = headingSlug(h[1]);
      slugs.add(heading);
    }
    const vid = VIDEO_LINE.exec(line.trim());
    if (vid) {
      const video = pickVideo(videos, fromRel, heading);
      if (video) return videoElement(video.name);
      throw new Error(`prepare-docs: ${fromRel}: no row in docs/videos/README.md for video asset ${vid[1]}`);
    }
    return line;
  });

  // Links can wrap across lines, so rewrite whole non-fenced runs.
  const rewritten = [];
  for (let i = 0; i < out.length; ) {
    let j = i;
    while (j < out.length && body[j].fenced === body[i].fenced) j++;
    const run = out.slice(i, j).join('\n');
    rewritten.push(body[i].fenced ? run : rewriteRun(run, fromRel, source));
    i = j;
  }

  for (const v of videos) {
    for (const t of v.targets) {
      if (t.file === fromRel && t.fragment !== null && !slugs.has(t.fragment)) {
        throw new Error(`Video target ${t.file}#${t.fragment} has no matching heading`);
      }
    }
  }

  return { frontmatter, body: rewritten.join('\n') };
}

export const renderPage = ({ frontmatter, body }, outPath = '') => {
  const fm = [`title: ${JSON.stringify(frontmatter.title)}`, `description: ${JSON.stringify(frontmatter.description)}`];
  if (frontmatter.slug !== undefined) fm.push(`slug: ${frontmatter.slug}`);
  const sidebar = frontmatter.sidebar ?? SIDEBAR_OVERRIDES[outPath];
  if (sidebar) fm.push('sidebar:', ...Object.entries(sidebar).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`));
  // long reference pages: only the h2 per endpoint or schema in the table of contents
  if (frontmatter.tableOfContents) fm.push('tableOfContents:\n  minHeadingLevel: 2\n  maxHeadingLevel: 2');
  return `---\n${fm.join('\n')}\n---\n\n${body.replace(/^\s*\n/, '')}`;
};

export function listMarkdown(docsDir, rel = '') {
  return readdirSync(join(docsDir, rel), { withFileTypes: true }).flatMap((e) => {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) return e.name === 'node_modules' || STATIC_DIRS.includes(p) || rel === 'videos' ? [] : listMarkdown(docsDir, p);
    return e.name.endsWith('.md') ? [p] : [];
  });
}

const outputPath = (rel) => (/readme\.md$/i.test(rel) ? posix.join(pageKey(rel), 'index.md') : `${pageKey(rel)}.md`);

if (isMain(import.meta.url)) {
  const root = repoRoot;
  const main = mainDir();
  const docsDir = join(main, 'docs');
  const outDir = join(root, 'docs/src/content/docs');
  const videos = videoIndex(readFileSync(join(docsDir, 'videos/README.md'), 'utf8'));

  resetDir(outDir);
  const files = listMarkdown(docsDir);
  for (const rel of files) {
    const page = transformMarkdown(readFileSync(join(docsDir, rel), 'utf8'), rel, videos);
    const out = outputPath(rel);
    const dest = join(outDir, out);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, renderPage(page, out));
  }

  for (const name of STATIC_DIRS) {
    const dest = join(root, 'docs/public', name);
    rmSync(dest, { recursive: true, force: true });
    if (existsSync(join(docsDir, name))) cpSync(join(docsDir, name), dest, { recursive: true });
  }

  // benchmark pages and their chart assets from both repos
  const dates = archiveDates(join(main, ARCHIVE));
  addArchivePages(dates);
  rmSync(join(root, 'docs/public/benchmarks'), { recursive: true, force: true });
  const copiedAssets = new Set();
  let benchmarkPages = 0;
  for (const [repo, dir] of [['main', main], ['jev', jevDir()]]) {
    for (const [repoPath, cfg] of Object.entries(BENCHMARK_PAGES[repo])) {
      const page = transformMarkdown(readFileSync(join(dir, repoPath), 'utf8'), repoPath, [], { repo, base: '', slug: cfg.slug });
      page.frontmatter.title = cfg.title;
      if (cfg.description) page.frontmatter.description = cfg.description;
      if (cfg.long) page.frontmatter.tableOfContents = true;
      if (cfg.sidebar) page.frontmatter.sidebar = cfg.sidebar;
      const out = `${cfg.slug}.md`;
      mkdirSync(dirname(join(outDir, out)), { recursive: true });
      writeFileSync(join(outDir, out), renderPage(page, out));
      benchmarkPages++;
      const assetDir = posix.join(posix.dirname(repoPath), 'report_assets');
      if (!copiedAssets.has(assetDir) && existsSync(join(dir, assetDir))) {
        cpSync(join(dir, assetDir), join(root, 'docs/public', publicAssetDir(repo, assetDir)), { recursive: true });
        copiedAssets.add(assetDir);
      }
    }
  }
  writeFileSync(join(outDir, 'benchmarks/llm/archive/index.md'), renderPage(archiveIndex(dates), 'benchmarks/llm/archive/index.md'));

  // the app serves its spec with the running version; the docs copy carries the release it was built from
  const version = /__version__ = "([^"]+)"/.exec(readFileSync(join(main, 'version.py'), 'utf8'))?.[1];
  if (!version) throw new Error('prepare-docs: no __version__ in version.py');
  const specText = readFileSync(join(main, 'openapi.yaml'), 'utf8').replace(/^  version: .*$/m, `  version: ${version}`);
  writeFileSync(join(root, 'docs/public/openapi.yaml'), specText);
  const spec = parseYaml(specText);
  writeFileSync(join(root, 'docs/public/openapi.json'), JSON.stringify(spec, null, 2) + '\n');
  const api = apiPages(spec, version);
  mkdirSync(join(outDir, 'api'), { recursive: true });
  for (const page of api) writeFileSync(join(outDir, page.path), renderPage(page, page.path));

  const assets = join(root, 'docs/src/assets/generated');
  mkdirSync(assets, { recursive: true });
  for (const f of ['logo.svg', 'logo-dark.svg']) cpSync(join(main, 'frontend/public', f), join(assets, f));
  cpSync(join(main, 'frontend/public/favicon.svg'), join(root, 'docs/public/favicon.svg'));

  console.log(`prepare-docs: wrote ${files.length} pages, ${benchmarkPages + 1} benchmark pages and ${api.length} API reference pages`);
}
