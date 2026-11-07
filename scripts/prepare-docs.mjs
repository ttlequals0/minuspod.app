import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { isMain, resetDir } from './lib/cli.mjs';
import { mainDir, repoRoot } from './lib/main-dir.mjs';
import { ATTR_RE, LINK_RE, fenceMask, firstH1, firstParagraph, headingSlug, isExternalHref, isNavLine, mapSrcset, truncateWords } from './lib/md.mjs';
import { videoIndex } from './lib/videos.mjs';

const GH = 'https://github.com/ttlequals0/MinusPod';
const STATIC_DIRS = ['images', 'screenshots', 'schemas', 'examples'];
// Sidebar frontmatter by output path relative to the docs content dir.
const SIDEBAR_OVERRIDES = { 'specs/index.md': { label: 'Overview', order: 0 } };
const VIDEO_LINE = /^https:\/\/github\.com\/user-attachments\/assets\/([\w-]+)$/;
const THEMED_PICTURE = /<picture>\s*<source\b([^>]*)>\s*<img\b([^>]*?)\s*\/?>\s*<\/picture>/g;

// Lowercased page path without .md; a trailing README names its directory.
const pageKey = (rel) => rel.slice(0, -3).toLowerCase().replace(/(^|\/)readme$/, '');

export function rewriteLink(href, fromRel) {
  if (isExternalHref(href) || href.startsWith('#')) return href;
  const hash = href.indexOf('#');
  const path = hash === -1 ? href : href.slice(0, hash);
  const fragment = hash === -1 ? '' : href.slice(hash);
  if (!path) return href;
  const repoPath = posix.normalize(posix.join('docs', posix.dirname(fromRel), path));

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
    return 'https://demo.minuspod.app/api-docs/';
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

// Starlight's theme picker sets data-theme, which a prefers-color-scheme source ignores.
const splitThemedPictures = (text) =>
  text.replace(THEMED_PICTURE, (m, source, img) => {
    const dark = /\bsrcset="([^"]+)"/.exec(source);
    if (!/media="\(prefers-color-scheme:\s*dark\)"/.test(source) || !dark) return m;
    const alt = /\balt="[^"]*"/.exec(img)?.[0] ?? 'alt=""';
    const light = /\bclass="/.test(img) ? img.replace(/\bclass="/, 'class="dark:sl-hidden ') : `${img} class="dark:sl-hidden"`;
    return `<img${light}>\n<img ${alt} src="${dark[1]}" class="light:sl-hidden">`;
  });

const rewriteRun = (text, fromRel) => rewriteAttrs(rewriteLinks(splitThemedPictures(text), fromRel), fromRel);

export function transformMarkdown(src, fromRel, videos = []) {
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
    if (fenced[i] || !/^##\s+Contents\s*$/.test(l) || drop.has(i)) return;
    let end = i + 1;
    while (end < lines.length && !(!fenced[end] && /^#{1,6}\s/.test(lines[end])) && (!lines[end].trim() || (!fenced[end] && isTocItem(lines[end])))) end++;
    if (lines.slice(i + 1, end).some((l) => l.trim())) {
      for (let j = i; j < end; j++) drop.add(j);
    }
  });

  const body = lines.flatMap((text, i) => (drop.has(i) ? [] : [{ text, fenced: fenced[i] }]));

  const description = truncateWords(firstParagraph(body.map((l) => l.text), body.map((l) => l.fenced)), 160);
  const frontmatter = { title: h1?.text ?? '', description };
  const slug = pageKey(fromRel);
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
    rewritten.push(body[i].fenced ? run : rewriteRun(run, fromRel));
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
  const sidebar = SIDEBAR_OVERRIDES[outPath];
  if (sidebar) fm.push(`sidebar:\n  label: ${sidebar.label}\n  order: ${sidebar.order}`);
  return `---\n${fm.join('\n')}\n---\n\n${body.replace(/^\s*\n/, '')}`;
};

export function listMarkdown(docsDir, rel = '') {
  return readdirSync(join(docsDir, rel), { withFileTypes: true }).flatMap((e) => {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) return e.name === 'node_modules' || STATIC_DIRS.includes(p) ? [] : listMarkdown(docsDir, p);
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

  const assets = join(root, 'docs/src/assets/generated');
  mkdirSync(assets, { recursive: true });
  for (const f of ['logo.svg', 'logo-dark.svg']) cpSync(join(main, 'frontend/public', f), join(assets, f));
  cpSync(join(main, 'frontend/public/favicon.svg'), join(root, 'docs/public/favicon.svg'));

  console.log(`prepare-docs: wrote ${files.length} pages`);
}
