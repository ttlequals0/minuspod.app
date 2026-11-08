// RFC 9727 API catalog, served at /.well-known/api-catalog on both sites; _headers sets the linkset+json type
export const CATALOG = {
  linkset: [
    {
      anchor: 'https://docs.minuspod.app/api-and-webhooks/',
      'service-desc': [
        { href: 'https://docs.minuspod.app/openapi.yaml', type: 'application/yaml' },
        { href: 'https://docs.minuspod.app/openapi.json', type: 'application/json' },
      ],
      'service-doc': [{ href: 'https://docs.minuspod.app/api-and-webhooks/', type: 'text/html' }],
    },
  ],
};

const link = (rel, { href, type }) => `<${href}>; rel="${rel}"${rel === 'service-desc' ? `; type="${type}"` : ''}`;

// the Link header every HTML page carries; the Markdown twin is added per page
export const LINKS = [
  '</.well-known/api-catalog>; rel="api-catalog"',
  ...CATALOG.linkset.flatMap((entry) => ['service-desc', 'service-doc'].flatMap((rel) => entry[rel].map((target) => link(rel, target)))),
];

// Astro static endpoint: emits the file, the host adds the content type
export const GET = () => new Response(JSON.stringify(CATALOG, null, 2) + '\n');
