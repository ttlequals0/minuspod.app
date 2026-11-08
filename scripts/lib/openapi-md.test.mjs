import { describe, expect, it } from 'vitest';
import { apiPages, operationMarkdown, propertyItems, prose, resolveRef, schemaBlock, tagSlug, tagTitle, typeOf } from './openapi-md.mjs';

const spec = {
  openapi: '3.1.0',
  info: { title: 'T', description: 'The API.', version: '1.2.3' },
  servers: [{ url: '/api/v1' }],
  tags: [
    { name: 'Feeds', description: '- not prose\n\nPodcast feed management\n\nMore.' },
    { name: 'Audio Cue Templates', description: 'Cues' },
  ],
  components: {
    securitySchemes: { sessionCookie: { type: 'apiKey', in: 'cookie', name: 'session', description: 'Session cookie from login.' } },
    parameters: { slug: { name: 'slug', in: 'path', required: true, schema: { type: 'string' }, description: 'Feed slug' } },
    responses: { NotFound: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } },
    schemas: {
      Error: { type: 'object', required: ['error'], properties: { error: { type: 'string', description: 'What went wrong | why' } } },
      Feed: {
        type: 'object',
        description: 'A feed.',
        properties: {
          slug: { type: 'string' },
          mode: { type: 'string', enum: ['standard', 'keep'], default: 'standard' },
          episodes: { type: 'array', items: { $ref: '#/components/schemas/Error' } },
          stats: { type: 'object', properties: { total: { type: 'integer' } } },
        },
      },
      Tuned: { allOf: [{ $ref: '#/components/schemas/Feed' }, { type: 'object', properties: { max: { type: 'integer', const: 255 } } }] },
    },
  },
  paths: {
    '/feeds/{slug}': {
      parameters: [{ $ref: '#/components/parameters/slug' }],
      get: {
        tags: ['Feeds'],
        summary: 'Get a single feed',
        description: 'Returns one feed.',
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' }, description: 'Feed slug (overrides)' }],
        responses: {
          200: { description: 'Feed details', content: { 'application/json': { schema: { $ref: '#/components/schemas/Feed' } } } },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: { tags: ['Feeds'], summary: 'Delete', responses: { 204: { description: 'Deleted' } } },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in',
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['password'], properties: { password: { type: 'string', description: 'Plain text, like <secret>' } } } } } },
        responses: {
          200: { description: 'Logged in', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, items: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' } } } } } } } } },
          401: { description: 'Nope', content: { 'audio/mpeg': {} } },
        },
      },
    },
  },
};

describe('typeOf', () => {
  it('links refs, spells arrays, enums, constants and nullables', () => {
    expect(typeOf(spec, { $ref: '#/components/schemas/Feed' })).toBe('[Feed](/api/schemas/#feed)');
    expect(typeOf(spec, { type: 'array', items: { $ref: '#/components/schemas/Error' } })).toBe('array of [Error](/api/schemas/#error)');
    expect(typeOf(spec, { type: 'string', enum: ['a', 'b'], format: 'date-time' })).toBe('string (date-time), one of `a`, `b`');
    expect(typeOf(spec, { type: 'integer', const: 255 })).toBe('constant `255`');
    expect(typeOf(spec, { type: ['object', 'null'] })).toBe('object or null');
    expect(typeOf(spec, { type: 'string', nullable: true })).toBe('string or null');
    expect(typeOf(spec, { oneOf: [{ type: 'string' }, { type: 'integer' }] })).toBe('one of string, integer');
  });
});

describe('propertyItems', () => {
  it('flattens nested objects with dotted names', () => {
    const items = propertyItems(spec, spec.components.schemas.Feed);
    expect(items).toEqual([
      '- `slug` (string)',
      '- `mode` (string, one of `standard`, `keep`): Default `standard`.',
      '- `episodes` (array of [Error](/api/schemas/#error))',
      '- `stats` (object)',
      '- `stats.total` (integer)',
    ]);
    expect(propertyItems(spec, spec.components.schemas.Error)).toEqual(['- `error` (string, required): What went wrong \\| why']);
  });
});

describe('operationMarkdown', () => {
  it('renders path-level parameters, resolved responses and linked bodies', () => {
    const get = spec.paths['/feeds/{slug}'].get;
    const md = operationMarkdown(spec, 'get', '/feeds/{slug}', { ...get, parameters: [...spec.paths['/feeds/{slug}'].parameters, ...get.parameters] }).join('\n');
    expect(md).toContain('## GET /feeds/{slug}\n\nGet a single feed\n\nReturns one feed.');
    expect(md).toContain('### Parameters\n\n- `slug` (path, string, required): Feed slug (overrides)\n\n### Responses');
    expect(md).toContain('| 200 | Feed details | [Feed](/api/schemas/#feed) |');
    expect(md).toContain('| 404 | Not found | [Error](/api/schemas/#error) |');
    expect(md).not.toContain('response body');
  });
  it('marks public endpoints and expands inline request and response objects', () => {
    const md = operationMarkdown(spec, 'post', '/auth/login', spec.paths['/auth/login'].post).join('\n');
    expect(md).toContain('No session needed.');
    expect(md).toContain('### Request body (application/json, required)\n\n- `password` (string, required): Plain text, like &lt;secret>\n');
    expect(md).toContain('| 200 | Logged in | object |');
    expect(md).toContain('| 401 | Nope | audio/mpeg |');
    expect(md).toContain('#### 200 response body\n\n- `ok` (boolean)\n- `items` (array of object)\n- `items[].id` (integer)\n');
  });
});

describe('apiPages', () => {
  const pages = apiPages(spec, '9.9.9');
  it('writes an index, one page per tag in spec order and a schemas page', () => {
    expect(pages.map((p) => p.path)).toEqual(['api/index.md', 'api/feeds.md', 'api/auth.md', 'api/schemas.md']);
    expect(pages.map((p) => p.frontmatter.sidebar)).toEqual([{ order: 0, label: 'Overview' }, { order: 1 }, { order: 2 }, { order: 3 }]);
    expect(pages.every((p) => p.frontmatter.tableOfContents)).toBe(true);
    const index = pages[0].body;
    expect(index).toContain('version 9.9.9');
    expect(index).toContain('Session cookie from login.');
    expect(index).toContain('| [Feeds](/api/feeds/) | 2 | Podcast feed management |');
    expect(pages[1].frontmatter).toEqual({ title: 'Feeds', description: 'Podcast feed management', sidebar: { order: 1 }, tableOfContents: true });
    expect(pages[2].frontmatter.description).toBe('1 endpoint');
    expect(index).toContain('| [Auth](/api/auth/) | 1 |  |');
  });
  it('renders component schemas, allOf included, with anchors matching the links', () => {
    const schemas = pages.at(-1).body;
    expect(schemas).toContain('## Feed\n\nA feed.\n\n- `slug` (string)\n');
    expect(schemas).toContain('## Tuned\n\nIncludes every field of [Feed](/api/schemas/#feed).\n\n- `max` (constant `255`)\n');
  });
  it('ends every body with one newline and no blank runs', () => {
    expect(pages[0].body.endsWith('|\n')).toBe(true);
    expect(pages.some((p) => /\n{3,}/.test(p.body))).toBe(false);
  });
});

it('escapes angle brackets and ampersands outside code spans', () => {
  expect(prose('Set <slug> & keep `<data>/x` and &amp; as is')).toBe('Set &lt;slug> &amp; keep `<data>/x` and &amp; as is');
});

it('describes maps and arrays of composed objects', () => {
  expect(typeOf(spec, { type: 'object', additionalProperties: { type: 'string', enum: ['remove', 'keep'] } })).toBe('map of string, one of `remove`, `keep`');
  expect(schemaBlock(spec, { type: 'array', items: { allOf: [{ $ref: '#/components/schemas/Error' }, { type: 'object', properties: { n: { type: 'integer' } } }] } })).toEqual([
    'Array of:',
    '',
    'Includes every field of [Error](/api/schemas/#error).',
    '',
    '- `n` (integer)',
    '',
  ]);
  expect(schemaBlock(spec, { type: 'object' })).toEqual(['Free-form object.']);
});

it('tagSlug, tagTitle and resolveRef', () => {
  expect(tagSlug('Podcast Discovery')).toBe('podcast-discovery');
  expect(tagTitle('YouTube')).toBe('YouTube');
  expect(tagSlug('YouTube')).toBe('youtube');
  expect(resolveRef({ components: { responses: { 'Not/Found': { description: 'nf' } } } }, { $ref: '#/components/responses/Not~1Found' }).description).toBe('nf');
  expect(tagSlug('AudioCueTemplates')).toBe('audio-cue-templates');
  expect(tagTitle('AudioCueTemplates')).toBe('Audio Cue Templates');
  expect(tagTitle('Podcasting 2.0')).toBe('Podcasting 2.0');
  expect(resolveRef(spec, { $ref: '#/components/parameters/slug' }).name).toBe('slug');
});
