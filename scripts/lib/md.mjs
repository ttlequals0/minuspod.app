const LINK_RE = /(!?)\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g;

export const linkText = (s) => s.replace(LINK_RE, (_, bang, text) => (bang ? '' : text));

export const stripMarkdown = (s) =>
  linkText(s).replace(/`([^`]*)`/g, '$1').replace(/(\*\*|__|\*|_)(\S(?:.*?\S)?)\1/g, '$2').trim();

export const headingSlug = (text) =>
  stripMarkdown(text).toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, '');

const NAV_ITEM = /^\[[^\]]*\]\([^)]*\)$/;

export function isNavLine(line) {
  const t = line.trim();
  if (/^\[</.test(t)) return true;
  if (!t.includes('|')) return false;
  return t.split('|').every((part) => NAV_ITEM.test(part.trim()));
}

// Returns, per line, whether it sits inside (or opens/closes) a fenced block.
export function fenceMask(lines) {
  let marker = null;
  return lines.map((line) => {
    const m = /^\s*(```+|~~~+)/.exec(line);
    if (marker) {
      if (m && m[1][0] === marker[0] && m[1].length >= marker.length) marker = null;
      return true;
    }
    if (m) {
      marker = m[1];
      return true;
    }
    return false;
  });
}

export function firstH1(lines, fenced) {
  const i = lines.findIndex((l, n) => !fenced[n] && /^# /.test(l));
  return i === -1 ? null : { index: i, text: stripMarkdown(lines[i].slice(2)) };
}

const NON_PROSE = /^(#|\||<|```|~~~|[-*+] |\d+\. |>|https?:\/\/|!\[)/;

export function firstParagraph(lines, fenced) {
  let para = [];
  for (let i = 0; i <= lines.length; i++) {
    const blank = i === lines.length || (!fenced[i] && lines[i].trim() === '');
    if (!blank) {
      para.push(fenced[i] ? '```' : lines[i].trim());
      continue;
    }
    if (para.length && !NON_PROSE.test(para[0]) && !isNavLine(para[0])) {
      return stripMarkdown(para.join(' ')).replace(/\s+/g, ' ');
    }
    para = [];
  }
  return '';
}

export function truncateWords(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return (at > 0 && s[max] !== ' ' ? cut.slice(0, at) : cut).trimEnd();
}
