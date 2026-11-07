import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

function beaconHead() {
  const token = process.env.PUBLIC_CF_BEACON_TOKEN_DOCS;
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
    items: ['installation', 'environment-variables', 'feeds-and-usage', 'web-interface', 'videos'],
  },
  {
    label: 'Using MinusPod',
    items: [
      'how-it-works',
      'workflows',
      'configuration',
      'audio-cues',
      'pattern-cleanup',
      'transcript-differential',
      'download-history',
      'local-feeds',
      'youtube-feeds',
    ],
  },
  {
    label: 'Providers and transcription',
    items: ['llm-providers', 'system-one', 'transcription', 'transcription-openvino', 'failover'],
  },
  {
    label: 'Integrations',
    items: [
      'api-and-webhooks',
      'podcasting-2.0',
      'configuration-import-export',
      { label: 'API reference', link: 'https://demo.minuspod.app/api-docs/' },
    ],
  },
  { label: 'Operations', items: ['deployment', 'security-and-storage', 'container-security'] },
  { label: 'Reference', items: ['glossary'] },
  {
    label: 'Contributing',
    items: [
      'contributing',
      'releasing',
      { label: 'Design specs', items: ['specs', { autogenerate: { directory: 'specs' } }] },
    ],
  },
];

export default defineConfig({
  site: 'https://docs.minuspod.app',
  integrations: [
    starlight({
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
            href: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
          },
        },
        ...beaconHead(),
      ],
      sidebar: SIDEBAR,
    }),
  ],
});
