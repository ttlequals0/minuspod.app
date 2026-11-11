# minuspod.app

Static sites for MinusPod: a docs site and a landing page, both built with Astro.
Content comes from a checkout of the MinusPod main repo, which is never committed here.

## Layout

- `docs/`: Astro docs site
- `landing/`: Astro landing page
- `scripts/`: prepare scripts, the main checkout helper, and the dist checker
- `.main/`: clone of MinusPod main with its history and no old blobs; the video dates come from the history (gitignored)
- `.jev/`: shallow clone of MinusPodJev main, the source of the Jev benchmark pages (gitignored)
- `shared/theme/`: the theme picker both sites use (cookie store, inline bootstrap, picker wiring)
- `shared/generated/`: `npm run generate` output (gitignored): `tokens.css` with every pair from the app's `themes.ts`, `themes.json` for the pickers, and `repo-stats.json` with the landing footer's star and fork counts

Both sites show the same theme list as the app. The choice is stored in a `minuspod-theme` cookie on the parent domain, so the landing page and the docs open in the same pair and mode.

## Agent discovery

Both sites publish the same machine-readable surface, and `npm run check` fails when any of it
is missing:

- `robots.txt` carries a Content-Signal line and points at `sitemap.xml`, which is built from
  the page list. Starlight also writes its own `sitemap-index.xml`; the check fails if the two
  disagree.
- Every page has a Markdown twin. The Worker answers `Accept: text/markdown` on `/installation/`
  with `/installation.md`. Answers to requests that mention `text/markdown` carry
  `Vary: Accept`; browser responses do not, so prefetch caches can reuse them. A tab navigation
  (`Sec-Fetch-Dest: document`) always gets the HTML page, whatever its Accept header says.
- `/.well-known/api-catalog` points at the MinusPod OpenAPI spec (copied from the main repo to
  `docs.minuspod.app/openapi.yaml` and `openapi.json` at build time) and the API docs page. Every
  page names these and its twin in a `Link` header.
- The API reference under `docs.minuspod.app/api/` is generated from the spec at build time by
  `scripts/lib/openapi-md.mjs`: one page per tag, one for the schemas.

## Local loop

1. `npm install`
2. `npm run fetch:main` clones or refreshes `.main/` and `.jev/`
3. `npm run build` generates content from both checkouts and builds both sites
4. `npm test` runs the script tests

Pushes to main, docs-updated dispatches and manual runs deploy both sites through `.github/workflows/site.yml`.

To build against other checkouts, run `MAIN_REPO_DIR=$HOME/repos/MinusPod JEV_REPO_DIR=$HOME/repos/MinusPodJev npm run build`.
