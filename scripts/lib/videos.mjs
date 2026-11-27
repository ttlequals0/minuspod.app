import { posix } from 'node:path';
import { LINK_RE, linkText } from './md.mjs';

const DESCRIPTION_HEADING = 'What it shows';
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

// the catalog page lists the files; what each video shows is alt text on the gallery
export function withoutDescriptions(readme) {
  const lines = readme.split('\n');
  let col = -1;
  const head = lines.findIndex((l) => l.trim().startsWith('|') && (col = cells(l).indexOf(DESCRIPTION_HEADING)) !== -1);
  if (head === -1) throw new Error(`videos README: no "${DESCRIPTION_HEADING}" column`);
  for (let i = head; i < lines.length && lines[i].trim().startsWith('|'); i++) {
    lines[i] = `| ${cells(lines[i]).filter((_, n) => n !== col).join(' | ')} |`;
  }
  return lines.join('\n');
}

export function parseEmbedTable(readme) {
  const lines = readme.split('\n');
  const at = lines.findIndex((l) => /^##\s+Embedding in the docs\s*$/.test(l));
  if (at === -1) return [];
  return tableRows(lines.slice(at + 1)).map((row) => {
    const targets = [];
    for (const m of row[1].matchAll(LINK_RE)) {
      const [path, fragment] = m[3].split('#');
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
    title,
    targets: embeds.find((e) => e.title === title)?.targets ?? [],
  }));
}
