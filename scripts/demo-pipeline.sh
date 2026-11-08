#!/usr/bin/env bash
# Usage: demo-pipeline.sh <main-dir> <work-dir>
# Env: SNAPSHOT_DB ARTWORK_TAR OVERRIDES_TAR DEMO_LEAK_HOSTS (required);
#      IMAGE, TRANSCRIPT_WINDOW, SKIP_BUILD, CF_BEACON_TOKEN_DEMO (optional);
#      DEMO_WORKERS = gunicorn workers (default 8; rate limits are per worker).
set -euo pipefail

MAIN_DIR="$(cd "${1:?usage: demo-pipeline.sh <main-dir> <work-dir>}" && pwd)"
mkdir -p "${2:?usage: demo-pipeline.sh <main-dir> <work-dir>}"
WORK="$(cd "$2" && pwd)"
SITE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${IMAGE:-ttlequals0/minuspod:cpu}"
: "${SNAPSHOT_DB:?}" "${ARTWORK_TAR:?}" "${OVERRIDES_TAR:?}" "${DEMO_LEAK_HOSTS:?}"

CONTAINER=demo-app
CRAWL_DIR="$MAIN_DIR/scripts/demo/crawl"

RELAY=demo-relay
cleanup() {
  docker rm -f "$CONTAINER" "$RELAY" >/dev/null 2>&1 || true
  # hand the uid 1000 data dir back so the next run can delete it
  if [ -d "$WORK/data" ]; then
    docker run --rm --user root --entrypoint chown -v "$WORK/data:/app/data" "$IMAGE" \
      -R "$(id -u):$(id -g)" /app/data >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "::group::Prepare work dir"
cleanup
rm -rf "$WORK/data" "$WORK/crawl" "$WORK/fixtures" "$WORK/artwork" "$WORK/overrides" "$WORK/search-index.json"
mkdir -p "$WORK/data" "$WORK/crawl" "$WORK/fixtures"
cp "$SNAPSHOT_DB" "$WORK/data/podcast.db"
chmod 0644 "$WORK/data/podcast.db"
tar -xf "$ARTWORK_TAR" -C "$WORK"
tar -xf "$OVERRIDES_TAR" -C "$WORK"
echo "::endgroup::"

echo "::group::Start isolated app"
docker network inspect demo-net >/dev/null 2>&1 || docker network create --internal demo-net >/dev/null
docker run --rm --user root --entrypoint chown -v "$WORK/data:/app/data" "$IMAGE" -R 1000:1000 /app/data
docker run -d --name "$CONTAINER" --network demo-net -v "$WORK/data:/app/data" \
  -e MINUSPOD_BACKGROUND_THREADS=0 -e MINUSPOD_REQUIRE_AUTH=false \
  -e BASE_URL=https://demo.minuspod.app -e WHISPER_BACKEND=local \
  -e GUNICORN_WORKERS="${DEMO_WORKERS:-8}" -e MINUSPOD_RATE_LIMIT_DISABLED=true "$IMAGE" >/dev/null
APP_IP="$(docker inspect -f '{{(index .NetworkSettings.Networks "demo-net").IPAddress}}' "$CONTAINER" || true)"
BASE="http://$APP_IP:8000"
# Docker Desktop cannot route to container IPs: if the direct IP never answers, relay through a loopback port
reachable=0
for _ in $(seq 20); do
  if curl -sS --max-time 3 -o /dev/null "$BASE/" 2>/dev/null; then reachable=1; break; fi
  sleep 3
done
if [ "$reachable" != 1 ]; then
  docker run -d --name "$RELAY" -p 127.0.0.1::8000 alpine/socat \
    TCP-LISTEN:8000,fork,reuseaddr "TCP:$CONTAINER:8000" >/dev/null
  docker network connect demo-net "$RELAY"
  BASE="http://$(docker port "$RELAY" 8000/tcp | head -n 1)"
fi
healthy=0
for _ in $(seq 60); do
  if curl -fsS --max-time 3 "$BASE/api/v1/health" >/dev/null 2>&1; then healthy=1; break; fi
  sleep 3
done
if [ "$healthy" != 1 ]; then
  docker logs "$CONTAINER" || true
  echo "app did not become healthy within 180 s" >&2
  exit 1
fi
echo "::endgroup::"

echo "::group::Egress gate"
docker exec "$CONTAINER" python3 -c pass || { echo "egress gate: python3 unavailable in $CONTAINER" >&2; exit 1; }
if docker exec "$CONTAINER" python3 -c "import urllib.request; urllib.request.urlopen('https://example.com', timeout=5)" >/dev/null 2>&1; then
  echo "egress gate failed: container reached the internet, demo-net is not internal" >&2
  exit 1
fi
echo "egress blocked as expected"
echo "::endgroup::"

echo "::group::Search index"
search_total() { curl -fsS "$BASE/api/v1/search/stats" | python3 -c "import json,sys; print(json.load(sys.stdin)['stats'].get('total', 0))"; }
total="$(search_total)"
if [ "$total" = 0 ]; then
  curl -fsS -X POST "$BASE/api/v1/search/rebuild" >/dev/null
  total="$(search_total)"
  [ "$total" != 0 ] || { echo "search index is empty after rebuild" >&2; exit 1; }
fi
echo "search index total: $total"
echo "::endgroup::"

echo "::group::Crawl and fixtures"
cd "$CRAWL_DIR"
npm ci
npx playwright install --with-deps chromium
node crawl.mjs --base "$BASE" --ui-base /ui --out "$WORK/crawl"
node har-to-fixtures.mjs --har "$WORK/crawl/crawl.har" --out "$WORK/fixtures" --clean
node dumps.mjs --base "$BASE" --out "$WORK/fixtures" --overrides "$WORK/overrides" \
  ${TRANSCRIPT_WINDOW:+--transcript-window "$TRANSCRIPT_WINDOW"}
node build-search-index.mjs --fixtures "$WORK/fixtures" --out "$WORK/search-index.json"
node stage-artwork.mjs --from "$WORK/artwork" --to "$MAIN_DIR/frontend/demo/artwork" --clean
node check-coverage.mjs --api-dir "$MAIN_DIR/frontend/src/api" --fixtures "$WORK/fixtures"
echo "::endgroup::"

echo "::group::Feed XML"
rm -rf "$WORK/feeds-xml"
mkdir -p "$WORK/feeds-xml"
slugs="$(curl -fsS "$BASE/api/v1/feeds?includeLatestEpisodes=false" \
  | python3 -c "import json,sys; print('\n'.join(f['slug'] for f in json.load(sys.stdin)['feeds']))")"
[ -n "$slugs" ] || { echo "no feeds returned for the feed XML step" >&2; exit 1; }
count=0
while IFS= read -r slug; do
  # The Worker only serves slugs made of these characters (demo/worker.mjs FEED_PATH).
  [[ "$slug" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "feed slug is not servable by the demo Worker: $slug" >&2; exit 1; }
  status="$(curl -sS -o "$WORK/feeds-xml/$slug.xml" -w '%{http_code}' "$BASE/$slug")" || status=000
  [ "$status" = 200 ] || { echo "feed XML for $slug returned HTTP $status" >&2; exit 1; }
  # Skip "@" inside URL paths (cover@2x.jpg) by requiring a non-path character before the address.
  sed -E -i.bak 's#(^|[^/A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}#\1demo@example.invalid#g' "$WORK/feeds-xml/$slug.xml"
  rm -f "$WORK/feeds-xml/$slug.xml.bak"
  count=$((count + 1))
done <<< "$slugs"
printf '%s\n' "$slugs" | python3 -c "import json,sys; print(json.dumps(sys.stdin.read().split()))" > "$WORK/feeds-xml/index.json"
if [ -n "$DEMO_LEAK_HOSTS" ]; then
  IFS=, read -ra leak_hosts <<< "$(printf '%s' "$DEMO_LEAK_HOSTS" | tr -d '[:space:]')"
  for host in "${leak_hosts[@]}"; do
    [ -n "$host" ] || continue
    for f in "$WORK"/feeds-xml/*.xml; do
      if grep -qiF -- "$host" "$f"; then
        echo "feed XML $(basename "$f") mentions a protected host" >&2; exit 1
      elif [ $? -ne 1 ]; then
        echo "feed XML host check could not read $(basename "$f")" >&2; exit 1
      fi
    done
  done
else
  echo "DEMO_LEAK_HOSTS is empty: skipping the feed XML host check"
fi
echo "feed XML files: $count"
echo "::endgroup::"

echo "::group::Leak check"
cd "$MAIN_DIR"
PYTHONPATH=src:. python3 scripts/demo/leak_check.py --hosts "$DEMO_LEAK_HOSTS" \
  --sqlite "$WORK/data/podcast.db" "$WORK/fixtures" "$MAIN_DIR/frontend/demo/artwork" "$WORK/search-index.json"
echo "::endgroup::"

if [ "${SKIP_BUILD:-}" = 1 ]; then
  echo "SKIP_BUILD=1: stopping after the leak check"
  exit 0
fi

echo "::group::Build demo"
rm -rf "$MAIN_DIR/frontend/demo/fixtures"
cp -r "$WORK/fixtures" "$MAIN_DIR/frontend/demo/fixtures"
cp "$WORK/search-index.json" "$MAIN_DIR/frontend/demo/search-index.json"
cd "$MAIN_DIR/frontend"
npm ci
VITE_CF_BEACON_TOKEN="${CF_BEACON_TOKEN_DEMO:-}" npm run build:demo
cd "$SITE_DIR"
rm -rf demo/dist
cp -r "$MAIN_DIR/frontend/dist-demo" demo/dist
cp demo/public/_headers demo/dist/_headers
mkdir -p demo/dist/feeds-xml
cp "$WORK"/feeds-xml/*.xml "$WORK/feeds-xml/index.json" demo/dist/feeds-xml/
echo "::endgroup::"
