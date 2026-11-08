# Demo build

`scripts/demo-pipeline.sh` turns a data snapshot into the static demo in `demo/dist/`
(gitignored). It starts the MinusPod image on an internal Docker network, crawls it, builds
fixtures, runs the leak check and builds the frontend in demo mode.

Needs Docker, Node (see `.nvmrc`), Python 3 and a checkout of the MinusPod main repo.

```
export SNAPSHOT_DB=/path/demo-snapshot-YYYY-MM-DD.db
export ARTWORK_TAR=/path/artwork.tar
export OVERRIDES_TAR=/path/overrides.tar
export DEMO_LEAK_HOSTS=feeds.example.invalid,cdn.example.invalid
export TRANSCRIPT_WINDOW=600   # optional
bash scripts/demo-pipeline.sh $HOME/repos/MinusPod /tmp/demo-work
```

- The tarballs hold top-level `artwork/` and `overrides/` directories.
- `SKIP_BUILD=1` stops after the leak check. `IMAGE` overrides `ttlequals0/minuspod:cpu`.
- `CF_BEACON_TOKEN_DEMO` sets the analytics beacon token for the build (optional).
- `DEMO_WORKERS` sets the app's gunicorn workers (default 8); the rate limits are per worker.
- Each run starts a fresh `demo-app` container, because the backend rate limits repeat crawls.
- The leak check exit code stops the script before the build. It also scans the live-mutated `$WORK/data/podcast.db`.
- Each show's feed XML is dumped into `feeds-xml/` (with an `index.json` slug list) and the Worker serves it at `/<slug>`, also accepting `.xml` and `.rss`. The dump replaces every email address with `demo@example.invalid` and fails if a `DEMO_LEAK_HOSTS` host appears in any file.
- Preview with the Worker (exercises the `/api` 503 path): `npx wrangler dev --config demo/wrangler.jsonc --port 8788`.
- Preview without the Worker (static files only): `npx --prefix $HOME/repos/MinusPod/frontend vite preview --outDir demo/dist --port 8788`.
