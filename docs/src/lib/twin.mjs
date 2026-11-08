// Markdown twin of a docs page. prepare-docs renders themed screenshots as a light and a dark <img>
// (Starlight hides one) and videos as a <video>; agents get one image and a link instead.
const attr = (attrs, name) => new RegExp(`\\b${name}="([^"]*)"`).exec(attrs)?.[1] ?? '';

export const twinMarkdown = (title, body) =>
  `# ${title}\n\n${body
    .replace(/\n?<img\b[^>]*\bclass="[^"]*\blight:sl-hidden\b[^"]*"[^>]*>/g, '')
    .replace(/<img\b([^>]*)>/g, (m, attrs) => (attr(attrs, 'src') ? `![${attr(attrs, 'alt')}](${attr(attrs, 'src')})` : m))
    .replace(/<video\b[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/video>/g, 'Video: $1')}`;
