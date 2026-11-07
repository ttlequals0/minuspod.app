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
      sidebar: [],
    }),
  ],
});
