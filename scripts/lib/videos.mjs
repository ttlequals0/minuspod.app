import { posix } from 'node:path';
import { linkText } from './md.mjs';

const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

function tableRows(lines) {
  const start = lines.findIndex((l) => l.trim().startsWith('|'));
  if (start === -1) return [];
  const rows = [];
  for (let i = start + 2; i < lines.length && lines[i].trim().startsWith('|'); i++) rows.push(cells(lines[i]));
  return rows;
}

export function parseVideoTable(readme) {
  return tableRows(readme.split('\n')).flatMap((row) => {
    const m = /\(minuspod-(.+)-landscape\.mp4\)/.exec(row[2] ?? '');
    if (!m) return [];
    const description = linkText(row[4] ?? '').replace(/(?<=\.)\s+[^.]*\/\.$/, '');
    return [{ name: m[1], title: row[0], seconds: parseInt(row[3], 10), description }];
  });
}

export function parseEmbedTable(readme) {
  const lines = readme.split('\n');
  const at = lines.findIndex((l) => /^##\s+Embedding in the docs\s*$/.test(l));
  if (at === -1) return [];
  return tableRows(lines.slice(at + 1)).map((row) => {
    const targets = [];
    for (const m of row[1].matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const [path, fragment] = m[1].split('#');
      const file = posix.normalize(posix.join('videos', path));
      if (file.startsWith('..')) continue;
      targets.push({ file, fragment: fragment || null });
    }
    return { title: row[0], targets };
  });
}

export function videoIndex(readme) {
  const embeds = parseEmbedTable(readme);
  return parseVideoTable(readme).map(({ name, title }) => ({
    name,
    targets: embeds.find((e) => e.title === title)?.targets ?? [],
  }));
}
