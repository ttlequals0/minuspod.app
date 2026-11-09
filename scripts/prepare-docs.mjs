import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { isMain, resetDir } from './lib/cli.mjs';
import { jevDir, mainDir, repoRoot } from './lib/main-dir.mjs';
import { ATTR_RE, LINK_RE, fenceMask, firstH1, firstParagraph, headingSlug, isExternalHref, isNavLine, mapSrcset, describeText } from './lib/md.mjs';
import { videoIndex } from './lib/videos.mjs';
import { apiPages } from './lib/openapi-md.mjs';
import { ARCHIVE_DIR, ARCHIVE_SLUG, BENCHMARK_PAGES, RESULTS_SLUG } from '../shared/benchmark-pages.mjs';
import { parse as parseYaml } from 'yaml';
import { REPO_URL } from '../shared/repo.mjs';
import { SITE_NAME } from '../shared/social.mjs';

const GH_JEV = 'https://github.com/ttlequals0/MinusPodJev';
const STATIC_DIRS = ['images', 'screenshots', 'schemas', 'examples'];
// Sidebar frontmatter by output path relative to the docs content dir.
const SIDEBAR_OVERRIDES = { 'specs/index.md': { label: 'Overview', order: 0 } };
const VIDEO_LINE = /^https:\/\/github\.com\/user-attachments\/assets\/([\w-]+)$/;
const THEMED_PICTURE = /<picture>\s*<source\b([^>]*)>\s*<img\b([^>]*?)\s*\/?>\s*<\/picture>/g;

// Lowercased page path without .md; a trailing README names its directory.
const pageKey = (rel) => rel.slice(0, -3).toLowerCase().replace(/(^|\/)readme$/, '');

// Where a page comes from: the repo, the directory its relative path is under, the page table
// for cross-links, and its slug when it does not follow from the path. Docs pages are the default.
const REPOS = {
  main: { gh: REPO_URL, assetRoot: 'benchmarks/', publicRoot: '/benchmarks/' },
  jev: { gh: GH_JEV, assetRoot: 'benchmark/', publicRoot: '/benchmarks/jev/' },
};
const DOCS = { repo: 'main', base: 'docs', pages: BENCHMARK_PAGES };
const IMAGE = /\.(svg|png|jpe?g|webp|gif)$/i;

// Dated report directories under results/archive, newest first.
export const archiveDates = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'report.md')))
        .map((e) => e.name)
        .sort()
        .reverse()
    : [];

export const archivePages = (dates) =>
  Object.fromEntries(
    dates.map((date, i) => [
      `${ARCHIVE_DIR}/${date}/report.md`,
      {
        slug: `${ARCHIVE_SLUG}/${date}`,
        title: `LLM benchmark results, ${date}`,
        description: `The LLM benchmark run of ${date}: accuracy, cost, latency and JSON compliance per model.`,
        long: true,
        sidebar: { label: date, order: i + 1 },
      },
    ]),
  );

// The archive group needs an index page; the dated reports are generated upstream without one.
export const archiveIndex = (dates) => ({
  frontmatter: {
    title: 'Past LLM benchmark runs',
    description: 'Earlier runs of the LLM benchmark, newest first.',
    slug: ARCHIVE_SLUG,
    sidebar: { label: 'Overview', order: 0 },
  },
  body: `The current run is on the [results page](/${RESULTS_SLUG}/).\n\n${dates.map((d) => `- [${d}](/${ARCHIVE_SLUG}/${d}/)`).join('\n')}\n`,
});

export function rewriteLink(href, fromRel, source = DOCS) {
  if (isExternalHref(href)) return href;
  // a same-page link whose heading is missing (old generated reports) becomes plain text
  if (href.startsWith('#')) return source.anchors && !source.anchors.has(href.slice(1)) ? null : href;
  const hash = href.indexOf('#');
  const path = hash === -1 ? href : href.slice(0, hash);
  const fragment = hash === -1 ? '' : href.slice(hash);
  if (!path) return href;
  const repoPath = posix.normalize(posix.join(source.base, posix.dirname(fromRel), path));
  // a link that climbs out of the repo (copied from another repo's layout) becomes plain text
  if (repoPath.startsWith('../')) {
    console.warn(`prepare-docs: ${fromRel}: link ${href} leaves the repo`);
    return null;
  }
  const { gh, assetRoot, publicRoot } = REPOS[source.repo];

  const page = source.pages[source.repo][repoPath.endsWith('/') ? `${repoPath}README.md` : repoPath];
  if (page) return `/${page.slug}/${fragment}`;
  // benchmark pages collect the images they show (repo path -> public path) for copying
  if (source.assets && IMAGE.test(repoPath) && repoPath.startsWith(assetRoot)) {
    const publicPath = `${publicRoot}${repoPath.slice(assetRoot.length)}`;
    source.assets.set(repoPath, publicPath);
    return `${publicPath}${fragment}`;
  }
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
    return `${REPO_URL}#readme`;
  } else if (repoPath === 'openapi.yaml') {
    // the spec is rendered as the API reference; a schema pointer lands on its heading
    const schema = /^#\/components\/schemas\/([^/]+)$/.exec(fragment);
    return schema ? `/api/schemas/#${headingSlug(schema[1])}` : '/api/';
  }
  return `${REPO_URL}/${repoPath.endsWith('/') ? 'tree' : 'blob'}/main/${repoPath}${fragment}`;
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
  text.replace(LINK_RE, (m, bang, label, href, title = '') => {
    const target = rewriteLink(href, fromRel, source);
    const inner = rewriteLinks(label, fromRel, source);
    return target === null ? inner : `${bang}[${inner}](${target}${title})`;
  });

const rewriteAttrs = (text, fromRel, source) =>
  text.replace(ATTR_RE, (m, attr, val) => {
    const link = (u) => rewriteLink(u, fromRel, source) ?? u;
    const next = attr === 'srcset' ? mapSrcset(val, link) : link(val);
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

  // Links can wrap across lines, so rewrite whole non-fenced runs. Benchmark pages (not under
  // docs/) lose same-page links to headings they lack; docs pages keep them for check-dist to report.
  if (source.base === '') source = { ...source, anchors: slugs };
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

// Search engines cut a <title> past 70 characters. Starlight appends the site name to the page
// title, so a long H1 (the design specs) keeps its first clause as the tab title; the H1 and the
// sidebar still show the whole heading. A clause that is itself too long, or a single word, leaves
// the title alone.
const TITLE_SUFFIX = ` | ${SITE_NAME}`;
const TITLE_MAX = 70;
export function shortTitle(title) {
  if (title.length + TITLE_SUFFIX.length <= TITLE_MAX) return null;
  const clause = title.replace(/^\w+:\s+/, '').split(/: |, | \+ | \(/)[0];
  const short = clause.charAt(0).toUpperCase() + clause.slice(1) + TITLE_SUFFIX;
  return short.length <= TITLE_MAX && clause.includes(' ') ? short : null;
}

export const renderPage = ({ frontmatter, body }, outPath = '') => {
  const fm = [`title: ${JSON.stringify(frontmatter.title)}`, `description: ${JSON.stringify(frontmatter.description)}`];
  if (frontmatter.slug !== undefined) fm.push(`slug: ${frontmatter.slug}`);
  const short = shortTitle(frontmatter.title);
  if (short) fm.push('head:', '  - tag: title', `    content: ${JSON.stringify(short)}`);
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
  const dates = archiveDates(join(main, ARCHIVE_DIR));
  const pages = { main: { ...BENCHMARK_PAGES.main, ...archivePages(dates) }, jev: BENCHMARK_PAGES.jev };
  const files = listMarkdown(docsDir);
  for (const rel of files) {
    const page = transformMarkdown(readFileSync(join(docsDir, rel), 'utf8'), rel, videos, { ...DOCS, pages });
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

  // benchmark pages from both repos, with the images they reference
  rmSync(join(root, 'docs/public/benchmarks'), { recursive: true, force: true });
  let benchmarkPages = 0;
  for (const [repo, dir] of [['main', main], ['jev', jevDir()]]) {
    for (const [repoPath, cfg] of Object.entries(pages[repo])) {
      const assets = new Map();
      const page = transformMarkdown(readFileSync(join(dir, repoPath), 'utf8'), repoPath, [], { repo, base: '', slug: cfg.slug, pages, assets });
      page.frontmatter.title = cfg.title;
      if (cfg.description) page.frontmatter.description = cfg.description;
      if (cfg.long) page.frontmatter.tableOfContents = true;
      if (cfg.sidebar) page.frontmatter.sidebar = cfg.sidebar;
      const out = `${cfg.slug}.md`;
      mkdirSync(dirname(join(outDir, out)), { recursive: true });
      writeFileSync(join(outDir, out), renderPage(page, out));
      benchmarkPages++;
      for (const [asset, publicPath] of assets) {
        const dest = join(root, 'docs/public', publicPath);
        mkdirSync(dirname(dest), { recursive: true });
        cpSync(join(dir, asset), dest);
      }
    }
  }
  mkdirSync(join(outDir, ARCHIVE_SLUG), { recursive: true });
  writeFileSync(join(outDir, `${ARCHIVE_SLUG}/index.md`), renderPage(archiveIndex(dates), `${ARCHIVE_SLUG}/index.md`));

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
