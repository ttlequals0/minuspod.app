import type { APIRoute } from 'astro';
import videos from '../generated/videos.json';
import { pitch } from '../generated/pitch.json';
import { formatLength, videoUrl, watchPath } from '../lib/video';
import { REPO_URL } from '../../../shared/repo.mjs';

export const GET: APIRoute = ({ site }) => {
  const abs = (p: string) => new URL(p, site).href;
  const demo = videos.find((v) => v.name === 'demo');
  const lines = [
    '# MinusPod',
    '',
    pitch,
    '',
    '- Documentation: https://docs.minuspod.app/',
    `- Source and releases: ${REPO_URL}`,
    '- Demo: https://demo.minuspod.app/',
    `- Gallery: ${abs('/gallery/')}`,
  ];
  if (demo) {
    lines.push('', '## A tour of the web UI', '', `${demo.title} (${formatLength(demo.seconds)}): ${demo.description}`, '', `Page: ${abs(watchPath(demo.name))}`, '', `Video: ${abs(videoUrl(demo.name))}`);
  }
  return new Response(lines.join('\n') + '\n');
};
