import type { APIRoute } from 'astro';
import videos from '../generated/videos.json';
import screenshots from '../generated/screenshots.json';
import { formatLength, videoUrl } from '../lib/video';

export const GET: APIRoute = ({ site }) => {
  const abs = (p: string) => new URL(p, site).href;
  const lines = ['# Gallery', '', 'Videos and screenshots of MinusPod.', '', '## Videos', ''];
  for (const v of videos) lines.push(`- ${v.title} (${formatLength(v.seconds)}): ${v.description} Video: ${abs(videoUrl(v.name))}`);
  lines.push('', '## Screenshots');
  for (const g of screenshots) {
    lines.push('', `### ${g.label}`, '');
    for (const f of g.files) lines.push(`- ${f.kind === 'mobile' ? 'Phone' : 'Desktop'} (${f.w} x ${f.h}): ${abs(`/screenshots/${f.file}`)}`);
  }
  return new Response(lines.join('\n') + '\n');
};
