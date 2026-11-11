import type { APIRoute } from 'astro';
import { formatLength, videoUrl, watchPaths } from '../../lib/video';

export const getStaticPaths = watchPaths;

export const GET: APIRoute = ({ site, props }) => {
  const { video } = props;
  const abs = (p: string) => new URL(p, site).href;
  const lines = [`# ${video.title}`, '', video.description, '', `- Length: ${formatLength(video.seconds)}`, `- Video: ${abs(videoUrl(video.name))}`, `- Gallery: ${abs('/gallery/')}`];
  return new Response(lines.join('\n') + '\n');
};
