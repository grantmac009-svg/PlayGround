#!/usr/bin/env bash
# Capture desktop and mobile screenshots of $CAPTURE_URL into $CAPTURE_DIR.
set -euo pipefail
cd "$(dirname "$0")"

step() { printf '[capture.sh] %s\n' "$*"; }
run() {
  step "\$ $*"
  /usr/bin/time -p "$@"
}

if [[ -z "${CAPTURE_URL:-}" ]]; then
  step 'error: CAPTURE_URL is required' >&2
  exit 1
fi
if [[ -z "${CAPTURE_DIR:-}" ]]; then
  step 'error: CAPTURE_DIR is required' >&2
  exit 1
fi

step "url=$CAPTURE_URL"
step "output=$CAPTURE_DIR"
run test -f capture.mjs
run node capture.mjs
