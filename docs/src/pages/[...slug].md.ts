import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { twinMarkdown } from '../lib/twin.mjs';

// the Markdown twin of every docs page, served to Accept: text/markdown by the Worker
export async function getStaticPaths() {
  const docs = await getCollection('docs');
  return docs.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}

export const GET: APIRoute = ({ props }) => new Response(twinMarkdown(props.entry.data.title, props.entry.body ?? ''));
