import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { existsSync, readFileSync } from 'node:fs';
import { beaconToken } from '../shared/beacon.mjs';
import { presentPages } from '../shared/sidebar.mjs';
import { benchmarkSidebar } from '../shared/benchmark-pages.mjs';
import { SOCIAL_IMAGE_ALT, SOCIAL_IMAGE_URL, hasSocialImage } from '../shared/social.mjs';

function beaconHead() {
  const token = beaconToken(process.env.PUBLIC_CF_BEACON_TOKEN_DOCS);
  if (!token) return [];
  return [
    {
      tag: 'script',
      attrs: {
        defer: true,
        src: 'https://static.cloudflareinsights.com/beacon.min.js',
        'data-cf-beacon': JSON.stringify({ token }),
      },
    },
  ];
}

const CONTENT = new URL('./src/content/docs/', import.meta.url);
const hasPage = (slug) => ['.md', '.mdx', '/index.md'].some((ext) => existsSync(new URL(slug + ext, CONTENT)));

export const SIDEBAR = presentPages([
  {
    label: 'Get started',
    items: [
      { link: '/', label: 'Overview' },
      { slug: 'installation', label: 'Installation' },
      { slug: 'environment-variables', label: 'Environment variables' },
      { slug: 'feeds-and-usage', label: 'Finding feeds and usage' },
      { slug: 'web-interface', label: 'Web interface' },
      { slug: 'videos', label: 'Videos' },
    ],
  },
  {
    label: 'Using MinusPod',
    items: [
      { slug: 'how-it-works', label: 'How it works' },
      { slug: 'workflows', label: 'Episode processing workflows' },
      { slug: 'configuration', label: 'Configuration and experiments' },
      { slug: 'audio-cues', label: 'Audio cue detection' },
      { slug: 'pattern-cleanup', label: 'Pattern cleanup' },
      { slug: 'transcript-differential', label: 'Upstream transcript differential' },
      { slug: 'download-history', label: 'Download history' },
      { slug: 'local-feeds', label: 'Local feeds' },
      { slug: 'youtube-feeds', label: 'YouTube feeds' },
    ],
  },
  {
    label: 'Providers and transcription',
    items: [
      { slug: 'llm-providers', label: 'LLM providers' },
      { slug: 'system-one', label: 'System One' },
      { slug: 'transcription', label: 'Transcription' },
      { slug: 'transcription-openvino', label: 'Intel GPU transcription (OpenVINO)' },
      { slug: 'failover', label: 'Failover' },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { slug: 'api-and-webhooks', label: 'API and webhooks' },
      { slug: 'podcasting-2.0', label: 'Podcasting 2.0' },
      { slug: 'configuration-import-export', label: 'Configuration import and export' },
      { label: 'API reference', items: [{ autogenerate: { directory: 'api' } }] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { slug: 'deployment', label: 'Deployment runbook' },
      { slug: 'security-and-storage', label: 'Security, storage and custom assets' },
      { slug: 'container-security', label: 'Container security updates' },
    ],
  },
  { label: 'Reference', items: [{ slug: 'glossary', label: 'Glossary' }] },
  benchmarkSidebar(),
  {
    label: 'Contributing',
    items: [
      { slug: 'contributing', label: 'Contributing' },
      { slug: 'releasing', label: 'Releasing' },
      { slug: 'demo-changelog', label: 'Demo changelog' },
      { label: 'Design specs', items: [{ autogenerate: { directory: 'specs' } }] },
    ],
  },
], hasPage);

// Starlight sets twitter:card to summary_large_image without an image; the landing poster fills it
// when prepare-landing produced the demo video (landing/src/generated/videos.json).
function socialImageHead() {
  const videosFile = new URL('../landing/src/generated/videos.json', import.meta.url);
  if (!existsSync(videosFile) || !hasSocialImage(JSON.parse(readFileSync(videosFile, 'utf8')))) return [];
  return [
    { tag: 'meta', attrs: { property: 'og:image', content: SOCIAL_IMAGE_URL } },
    { tag: 'meta', attrs: { property: 'og:image:alt', content: SOCIAL_IMAGE_ALT } },
    { tag: 'meta', attrs: { name: 'twitter:image:alt', content: SOCIAL_IMAGE_ALT } },
  ];
}

export default defineConfig({
  site: 'https://docs.minuspod.app',
  integrations: [
    starlight({
      routeMiddleware: './src/routeData.mjs',
      components: {
        ThemeProvider: './src/components/ThemeProvider.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
        MarkdownContent: './src/components/MarkdownContent.astro',
      },
      title: 'MinusPod',
      logo: {
        light: './src/assets/generated/logo.svg',
        dark: './src/assets/generated/logo-dark.svg',
        replacesTitle: true,
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/ttlequals0/MinusPod' },
      ],
      customCss: [
        ...[400, 500, 600, 700].map((w) => `@fontsource/roboto/${w}.css`),
        './src/styles/theme.css',
      ],
      head: [
        ...socialImageHead(),
        ...beaconHead(),
      ],
      sidebar: SIDEBAR,
    }),
  ],
});
