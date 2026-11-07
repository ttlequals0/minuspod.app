#!/usr/bin/env bash
set -euo pipefail

[ -n "${MAIN_REPO_DIR:-}" ] && exit 0

cd "$(dirname "$0")/.."
if [ -d .main/.git ]; then
  git -C .main fetch --depth 1 origin main
  git -C .main reset -q --hard origin/main
else
  git clone --depth 1 --branch main https://github.com/ttlequals0/MinusPod .main
fi
