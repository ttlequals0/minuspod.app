// RFC 9727 API catalog, served at /.well-known/api-catalog on both sites; _headers sets the linkset+json type
export const CATALOG = {
  linkset: [
    {
      anchor: 'https://docs.minuspod.app/api-and-webhooks/',
      'service-desc': [{ href: 'https://docs.minuspod.app/openapi.yaml', type: 'application/yaml' }],
      'service-doc': [{ href: 'https://docs.minuspod.app/api-and-webhooks/', type: 'text/html' }],
    },
  ],
};

const link = (rel, { href, type }) => `<${href}>; rel="${rel}"${rel === 'service-desc' ? `; type="${type}"` : ''}`;

// the Link header every HTML page carries; the Markdown twin is added per page
export const LINKS = [
  '</.well-known/api-catalog>; rel="api-catalog"',
  ...CATALOG.linkset.flatMap((entry) => ['service-desc', 'service-doc'].map((rel) => link(rel, entry[rel][0]))),
];

// Astro static endpoint: emits the file, the host adds the content type
export const GET = () => new Response(JSON.stringify(CATALOG, null, 2) + '\n');
