import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { beaconToken } from '../shared/beacon.mjs';

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

export const SIDEBAR = [
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
  {
    label: 'Contributing',
    items: [
      { slug: 'contributing', label: 'Contributing' },
      { slug: 'releasing', label: 'Releasing' },
      { label: 'Design specs', items: [{ autogenerate: { directory: 'specs' } }] },
    ],
  },
];

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
      customCss: ['./src/styles/theme.css'],
      head: [
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true } },
        {
          tag: 'link',
          attrs: {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;600;700&display=swap',
          },
        },
        ...beaconHead(),
      ],
      sidebar: SIDEBAR,
    }),
  ],
});
