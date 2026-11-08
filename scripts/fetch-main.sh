#!/usr/bin/env bash
# Shallow clones (or refreshes) the source repos the build reads: MinusPod into .main and
# MinusPodJev into .jev. A repo whose *_REPO_DIR variable points at a local checkout is skipped.
set -euo pipefail

cd "$(dirname "$0")/.."
fetch() {
  local repo="$1" dir="$2"
  if [ -d "$dir/.git" ]; then
    git -C "$dir" fetch --depth 1 origin main
    git -C "$dir" reset -q --hard origin/main
  else
    git clone --depth 1 --branch main "https://github.com/ttlequals0/$repo" "$dir"
  fi
}

[ -n "${MAIN_REPO_DIR:-}" ] || fetch MinusPod .main
[ -n "${JEV_REPO_DIR:-}" ] || fetch MinusPodJev .jev
