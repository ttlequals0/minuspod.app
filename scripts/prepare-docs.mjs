import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mainDir } from './lib/main-dir.mjs';
import { LINK_RE, fenceMask, firstH1, firstParagraph, headingSlug, isNavLine, mapSrcset, truncateWords } from './lib/md.mjs';
import { videoIndex } from './lib/videos.mjs';

const GH = 'https://github.com/ttlequals0/MinusPod';
const STATIC_DIRS = ['images', 'screenshots', 'schemas', 'examples'];
const ATTR_RE = /\b(src|srcset|href|poster)="([^"]+)"/g;
const VIDEO_LINE = /^https:\/\/github\.com\/user-attachments\/assets\/([\w-]+)$/;

export function rewriteLink(href, fromRel) {
  if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) return href;
  const hash = href.indexOf('#');
  const path = hash === -1 ? href : href.slice(0, hash);
  const fragment = hash === -1 ? '' : href.slice(hash);
  if (!path) return href;
  const repoPath = posix.normalize(posix.join('docs', posix.dirname(fromRel), path));

  if (repoPath.startsWith('docs/')) {
    const rel = repoPath.slice('docs/'.length);
    if (rel.endsWith('.md')) {
      const lower = rel.slice(0, -3).toLowerCase();
      const dir = lower.replace(/(^|\/)readme$/, '');
      return `/${dir ? `${dir}/` : ''}${fragment}`;
    }
    if (STATIC_DIRS.includes(rel.split('/')[0])) return `/${rel}${fragment}`;
    if (/^videos\/[^/]+\.mp4$/.test(rel)) return `https://minuspod.app/${rel}`;
  } else if (repoPath === 'README.md') {
    return `${GH}#readme`;
  } else if (repoPath === 'openapi.yaml') {
    return 'https://demo.minuspod.app/api-docs/';
  }
  return `${GH}/${repoPath.endsWith('/') ? 'tree' : 'blob'}/main/${repoPath}${fragment}`;
}

function pageSlug(fromRel) {
  const lower = fromRel.slice(0, -3).toLowerCase();
  if (lower === 'readme') return undefined;
  return lower.replace(/\/readme$/, '');
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

const rewriteLinks = (text, fromRel) =>
  text.replace(
    LINK_RE,
    (m, bang, label, href, title = '') =>
      `${bang}[${rewriteLinks(label, fromRel)}](${rewriteLink(href, fromRel)}${title})`,
  );

const rewriteAttrs = (text, fromRel) =>
  text.replace(ATTR_RE, (m, attr, val) => {
    const next = attr === 'srcset' ? mapSrcset(val, (u) => rewriteLink(u, fromRel)) : rewriteLink(val, fromRel);
    return `${attr}="${next}"`;
  });

const rewriteRun = (text, fromRel) => rewriteAttrs(rewriteLinks(text, fromRel), fromRel);

export function transformMarkdown(src, fromRel, videos = []) {
  const lines = src.split('\n');
  const fenced = fenceMask(lines);
  const h1 = firstH1(lines, fenced);
  const drop = new Set();
  if (h1) drop.add(h1.index);

  const navs = lines.flatMap((l, i) => (!fenced[i] && isNavLine(l) ? [i] : []));
  const isRule = (i) => !fenced[i] && lines[i].trim() === '---';
  for (const i of navs) {
    drop.add(i);
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (j < lines.length && isRule(j)) drop.add(j);
    j = i - 1;
    while (j >= 0 && lines[j].trim() === '') j--;
    if (j >= 0 && isRule(j)) drop.add(j);
  }

  const isHeading = (i) => !fenced[i] && /^#{1,6}\s/.test(lines[i]);
  const isTocItem = (l) => {
    if (!/^\s*[-*]\s/.test(l)) return false;
    const targets = [...l.matchAll(/\]\(([^)]*)\)/g)].map((m) => m[1]);
    return targets.length > 0 && targets.every((t) => t.startsWith('#'));
  };
  lines.forEach((l, i) => {
    if (fenced[i] || !/^##\s+Contents\s*$/.test(l) || drop.has(i)) return;
    let end = i + 1;
    while (end < lines.length && !isHeading(end) && (!lines[end].trim() || (!fenced[end] && isTocItem(lines[end])))) end++;
    const span = Array.from({ length: end - i - 1 }, (_, k) => i + 1 + k);
    if (span.some((j) => lines[j].trim())) {
      drop.add(i);
      span.forEach((j) => drop.add(j));
    }
  });

  const keptLines = lines.flatMap((l, i) => (drop.has(i) ? [] : [i]));
  const bodyLines = keptLines.map((i) => lines[i]);
  const bodyFenced = keptLines.map((i) => fenced[i]);

  const description = truncateWords(firstParagraph(bodyLines, bodyFenced), 160);
  const frontmatter = { title: h1?.text ?? '', description };
  const slug = pageSlug(fromRel);
  if (slug !== undefined) frontmatter.slug = slug;

  let heading = '';
  const out = bodyLines.map((line, i) => {
    if (bodyFenced[i]) return line;
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) heading = headingSlug(h[1]);
    const vid = VIDEO_LINE.exec(line.trim());
    if (vid) {
      const video = pickVideo(videos, fromRel, heading);
      if (video) return videoElement(video.name);
      console.error(`prepare-docs: ${fromRel}: no video for asset ${vid[1]}`);
      return line;
    }
    return line;
  });

  // Links can wrap across lines, so rewrite whole non-fenced runs.
  const rewritten = [];
  for (let i = 0; i < out.length; ) {
    let j = i;
    while (j < out.length && bodyFenced[j] === bodyFenced[i]) j++;
    const run = out.slice(i, j).join('\n');
    rewritten.push(bodyFenced[i] ? run : rewriteRun(run, fromRel));
    i = j;
  }

  return { frontmatter, body: rewritten.join('\n') };
}

const renderPage = ({ frontmatter, body }) => {
  const fm = [`title: ${JSON.stringify(frontmatter.title)}`, `description: ${JSON.stringify(frontmatter.description)}`];
  if (frontmatter.slug !== undefined) fm.push(`slug: ${frontmatter.slug}`);
  return `---\n${fm.join('\n')}\n---\n\n${body.replace(/^\s*\n/, '')}`;
};

function listMarkdown(docsDir, rel = '') {
  return readdirSync(join(docsDir, rel), { withFileTypes: true }).flatMap((e) => {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) return STATIC_DIRS.includes(p) || (rel === '' && e.name === 'videos') ? [] : listMarkdown(docsDir, p);
    return e.name.endsWith('.md') ? [p] : [];
  });
}

function outputPath(rel) {
  const lower = rel.toLowerCase();
  return lower.endsWith('readme.md') ? lower.replace(/readme\.md$/, 'index.md') : lower;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const main = mainDir();
  const docsDir = join(main, 'docs');
  const outDir = join(root, 'docs/src/content/docs');
  const videos = videoIndex(readFileSync(join(docsDir, 'videos/README.md'), 'utf8'));

  rmSync(outDir, { recursive: true, force: true });
  const files = [...listMarkdown(docsDir), 'videos/README.md'];
  for (const rel of files) {
    const page = transformMarkdown(readFileSync(join(docsDir, rel), 'utf8'), rel, videos);
    const dest = join(outDir, outputPath(rel));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, renderPage(page));
  }

  for (const name of STATIC_DIRS) {
    const dest = join(root, 'docs/public', name);
    rmSync(dest, { recursive: true, force: true });
    if (existsSync(join(docsDir, name))) cpSync(join(docsDir, name), dest, { recursive: true });
  }

  const assets = join(root, 'docs/src/assets/generated');
  mkdirSync(assets, { recursive: true });
  for (const f of ['logo.svg', 'logo-dark.svg']) cpSync(join(main, 'frontend/public', f), join(assets, f));
  cpSync(join(main, 'frontend/public/favicon.svg'), join(root, 'docs/public/favicon.svg'));

  console.log(`prepare-docs: wrote ${files.length} pages`);
}
