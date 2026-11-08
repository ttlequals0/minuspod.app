// Starlight pages from an OpenAPI document: one page per tag, one for the component schemas, an index.
import { fenceMask, firstParagraph, headingSlug, truncateWords } from './md.mjs';

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

// 'AudioCueTemplates' reads as 'Audio Cue Templates' in titles and 'audio-cue-templates' in paths;
// brand names that are camel case themselves stay as written
const BRANDS = { YouTube: 'YouTube' };
export const tagTitle = (name) => BRANDS[name] ?? name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
export const tagSlug = (name) => tagTitle(name).toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');
const apiHref = (slug) => `/api/${slug}/`;

// spec prose is Markdown, but placeholders such as <slug> outside code spans would parse as HTML
export const prose = (s) =>
  String(s ?? '').replace(/(`+[^`]*`+)|<|&(?![a-z0-9#]+;)/g, (m, span) => span ?? (m === '<' ? '&lt;' : '&amp;'));
const cell = (s) => prose(s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
const table = (header, rows) =>
  [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');
const code = (v) => `\`${typeof v === 'string' ? v : JSON.stringify(v)}\``;

const pointerKey = (k) => k.replace(/~1/g, '/').replace(/~0/g, '~');

export function resolveRef(spec, node) {
  while (node?.$ref) node = node.$ref.replace(/^#\//, '').split('/').reduce((o, k) => o?.[pointerKey(k)], spec);
  return node;
}

const schemaLink = (ref) => {
  const name = ref.split('/').pop();
  return `[${name}](${apiHref('schemas')}#${headingSlug(name)})`;
};

// one-line type of a schema; component references become links to the schemas page
export function typeOf(spec, schema) {
  if (!schema) return '';
  if (schema.$ref) return schemaLink(schema.$ref);
  const alts = schema.oneOf ?? schema.anyOf;
  if (alts) return `one of ${alts.map((s) => typeOf(spec, s)).join(', ')}`;
  if (schema.allOf) return schema.allOf.map((s) => typeOf(spec, s)).join(' plus ');
  if (schema.const !== undefined) return `constant ${code(schema.const)}`;
  const types = [].concat(schema.type ?? (schema.properties ? 'object' : 'any'));
  const values = typeof schema.additionalProperties === 'object' && !schema.properties && schema.additionalProperties;
  let out = types.includes('array') && schema.items ? `array of ${typeOf(spec, schema.items)}` : values ? `map of ${typeOf(spec, values)}` : types.join(' or ');
  if (schema.format) out += ` (${schema.format})`;
  if (schema.enum) out += `, one of ${schema.enum.map(code).join(', ')}`;
  if (schema.nullable && !types.includes('null')) out += ' or null';
  return out;
}

// one list item per field: `name` (type, required): description. Lists wrap on phones where
// four-column tables do not. Nested inline objects get dotted names, array items a [] suffix.
const item = (name, meta, text) => `- ${code(name)} (${meta.filter(Boolean).join(', ')})${text ? `: ${cell(text)}` : ''}`;

export function propertyItems(spec, schema, prefix = '') {
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).flatMap(([name, prop]) => {
    const text = [prop.description, prop.default !== undefined && `Default ${code(prop.default)}.`].filter(Boolean).join(' ');
    const line = item(`${prefix}${name}`, [typeOf(spec, prop), required.has(name) && 'required'], text);
    const inline = (s) => s && !s.$ref && s.properties;
    const nested = inline(prop) ? propertyItems(spec, prop, `${prefix}${name}.`) : inline(prop.items) ? propertyItems(spec, prop.items, `${prefix}${name}[].`) : [];
    return [line, ...nested];
  });
}

const fields = (spec, schema) => {
  const items = propertyItems(spec, schema);
  return items.length ? items.join('\n') : 'Free-form object.';
};

// markdown lines describing a schema in full
export function schemaBlock(spec, schema) {
  if (!schema || schema.$ref) return [typeOf(spec, schema) || 'No body.'];
  if (schema.allOf) {
    return schema.allOf.flatMap((part) => (part.$ref ? [`Includes every field of ${schemaLink(part.$ref)}.`, ''] : [fields(spec, part), '']));
  }
  if (schema.properties) return [fields(spec, schema)];
  if (schema.type === 'array' && schema.items && !schema.items.$ref && (schema.items.properties || schema.items.allOf)) {
    return ['Array of:', '', ...schemaBlock(spec, schema.items)];
  }
  if ([].concat(schema.type ?? []).includes('object') && typeof schema.additionalProperties !== 'object') return ['Free-form object.'];
  return [typeOf(spec, schema)];
}

export function operationMarkdown(spec, method, path, op) {
  const lines = [`## ${method.toUpperCase()} ${path}`, ''];
  if (op.deprecated) lines.push('Deprecated.', '');
  if (op.summary) lines.push(prose(op.summary.trim()), '');
  if (op.description && op.description.trim() !== op.summary?.trim()) lines.push(prose(op.description.trim()), '');
  if (Array.isArray(op.security) && op.security.length === 0) lines.push('No session needed.', '');
  // an operation parameter overrides the path-level one with the same name and location
  const params = [...new Map((op.parameters ?? []).map((p) => resolveRef(spec, p)).map((p) => [`${p.in}:${p.name}`, p])).values()];
  if (params.length) {
    lines.push('### Parameters', '', ...params.map((p) => item(p.name, [p.in, typeOf(spec, p.schema), p.required && 'required'], p.description)), '');
  }
  const body = resolveRef(spec, op.requestBody);
  for (const [type, media] of Object.entries(body?.content ?? {})) {
    lines.push(`### Request body (${type}${body.required ? ', required' : ''})`, '');
    if (body.description) lines.push(prose(body.description.trim()), '');
    lines.push(...schemaBlock(spec, media.schema), '');
  }
  const responses = Object.entries(op.responses ?? {}).map(([status, r]) => {
    const res = resolveRef(spec, r);
    const types = Object.keys(res.content ?? {});
    const json = res.content?.['application/json']?.schema;
    return { status, res, json, body: json ? typeOf(spec, json) : types.join(', ') };
  });
  if (responses.length) {
    lines.push('### Responses', '', table(['Status', 'Description', 'Body'], responses.map((r) => [r.status, r.res.description, r.body])), '');
    for (const { status, json } of responses) {
      const inline = json && !json.$ref && (json.properties || json.allOf || (json.type === 'array' && json.items?.properties));
      if (inline) lines.push(`#### ${status} response body`, '', ...schemaBlock(spec, json), '');
    }
  }
  return lines;
}

const summary = (text) => {
  const lines = (text ?? '').split('\n');
  return truncateWords(firstParagraph(lines, fenceMask(lines)), 160);
};

const page = (path, title, description, order, body, extra = {}) => ({
  path,
  frontmatter: { title, description, sidebar: { order, ...extra }, tableOfContents: true },
  body: body.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n',
});

// pages for prepare-docs' renderPage: the index, one per tag in spec order, the schemas
export function apiPages(spec, version) {
  const meta = new Map((spec.tags ?? []).map((t) => [t.name, t.description ?? '']));
  const byTag = new Map();
  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const method of METHODS) {
      const op = pathItem[method];
      if (!op) continue;
      const merged = { ...op, parameters: [...(pathItem.parameters ?? []), ...(op.parameters ?? [])] };
      for (const tag of op.tags?.length ? op.tags : ['Other']) {
        if (!byTag.has(tag)) byTag.set(tag, []);
        byTag.get(tag).push({ method, path, op: merged });
      }
    }
  }
  const tags = [...new Set([...meta.keys(), ...byTag.keys()])]
    .filter((t) => byTag.has(t))
    .map((name) => ({ name, slug: tagSlug(name), ops: byTag.get(name), summary: prose(summary(meta.get(name))) }));
  const count = (t) => `${t.ops.length} endpoint${t.ops.length === 1 ? '' : 's'}`;

  const schemes = Object.values(spec.components?.securitySchemes ?? {});
  const index = [
    prose((spec.info?.description ?? '').trim()),
    '',
    `All paths below are relative to \`${spec.servers?.[0]?.url ?? '/api/v1'}\` on your MinusPod host. Every endpoint needs the session unless it says otherwise.`,
    '',
    ...schemes.flatMap((s) => (s.description ? [prose(s.description.trim()), ''] : [])),
    `The machine-readable spec is [openapi.yaml](/openapi.yaml) or [openapi.json](/openapi.json), version ${version}. [API and webhooks](/api-and-webhooks/) covers authentication, CSRF and webhooks.`,
    '',
    table(['Group', 'Endpoints', 'Description'], tags.map((t) => [`[${tagTitle(t.name)}](${apiHref(t.slug)})`, t.ops.length, t.summary])),
  ];
  const schemas = Object.entries(spec.components?.schemas ?? {}).flatMap(([name, schema]) => [
    `## ${name}`,
    '',
    ...(schema.description ? [prose(schema.description.trim()), ''] : []),
    ...schemaBlock(spec, schema),
    '',
  ]);
  return [
    page('api/index.md', 'API reference', 'Every MinusPod REST endpoint, grouped by area, with request and response shapes.', 0, index, { label: 'Overview' }),
    ...tags.map((t, i) => page(`api/${t.slug}.md`, tagTitle(t.name), t.summary || count(t), i + 1, [prose(meta.get(t.name)?.trim()), '', ...t.ops.flatMap(({ method, path, op }) => operationMarkdown(spec, method, path, op))])),
    page('api/schemas.md', 'Schemas', 'The request and response objects shared across the API.', tags.length + 1, ['Objects referenced from the endpoint pages. Field names link back here.', '', ...schemas]),
  ];
}
