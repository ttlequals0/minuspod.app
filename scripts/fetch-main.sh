#!/usr/bin/env bash
# Clones (or refreshes) the source repos the build reads: MinusPod into .main and MinusPodJev
# into .jev. A repo whose *_REPO_DIR variable points at a local checkout is skipped.
set -euo pipefail

cd "$(dirname "$0")/.."
# arguments after the directory say how much to fetch
fetch() {
  local repo="$1" dir="$2"
  shift 2
  if [ -d "$dir/.git" ]; then
    # a depth 1 clone from before the history was needed gets it here
    if [ "$1" != --depth ] && [ "$(git -C "$dir" rev-parse --is-shallow-repository)" = true ]; then set -- --unshallow "$@"; fi
    git -C "$dir" fetch "$@" origin main
    git -C "$dir" reset -q --hard origin/main
  else
    git clone "$@" --single-branch --branch main "https://github.com/ttlequals0/$repo" "$dir"
  fi
}

# every commit but no old blobs: prepare-landing dates each video by its last commit
[ -n "${MAIN_REPO_DIR:-}" ] || fetch MinusPod .main --filter=blob:none
[ -n "${JEV_REPO_DIR:-}" ] || fetch MinusPodJev .jev --depth 1
