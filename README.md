# minuspod.app

Static sites for MinusPod: a docs site and a landing page, both built with Astro.
Content comes from a checkout of the MinusPod main repo, which is never committed here.

## Layout

- `docs/`: Astro docs site
- `landing/`: Astro landing page
- `scripts/`: prepare scripts, the main checkout helper, and the dist checker
- `.main/`: shallow clone of MinusPod main (gitignored)
- `shared/theme/`: the theme picker both sites use (cookie store, inline bootstrap, picker wiring)
- `shared/generated/`: `npm run generate` output (gitignored), `tokens.css` with every pair from the app's `themes.ts` plus the `themes.json` the pickers render from

Both sites show the same theme list as the app. The choice is stored in a `minuspod-theme` cookie on the parent domain, so the landing page and the docs open in the same pair and mode.

## Local loop

1. `npm install`
2. `npm run fetch:main` clones or refreshes `.main/`
3. `npm run build` generates content from `.main/` and builds both sites
4. `npm test` runs the script tests

Pushes to main, docs-updated dispatches and manual runs deploy both sites through `.github/workflows/site.yml`.

To build against another checkout, run `MAIN_REPO_DIR=$HOME/repos/MinusPod npm run build`.
