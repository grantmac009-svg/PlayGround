#!/usr/bin/env bash
# Build the static app when needed and serve it in the foreground on $PORT.
set -euo pipefail
cd "$(dirname "$0")"

PROJECT_DIR="$(pwd -P)"
PORT="${PORT:-3000}"
META_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
SRC_DIR="$PROJECT_DIR/src"
OUT_DIR="$PROJECT_DIR/dist"

step() { printf '[start.sh] %s\n' "$*"; }
run() {
  step "\$ $*"
  /usr/bin/time -p "$@"
}

step "project=$PROJECT_DIR"
step "port=$PORT"
step "built-output=$OUT_DIR"
step "metadata=$META_DIR"

install_dependencies() {
  if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
    step 'no package.json; skipping dependency install'
    return 0
  fi
  local stamp="$META_DIR/start-dependencies.sha256"
  local current=''
  current="$(
    {
      cat "$PROJECT_DIR/package.json"
      [[ -f "$PROJECT_DIR/package-lock.json" ]] && cat "$PROJECT_DIR/package-lock.json"
    } | sha256sum | cut -d' ' -f1
  )"
  if [[ -d "$PROJECT_DIR/node_modules" && -f "$stamp" && "$(cat "$stamp")" == "$current" ]]; then
    step 'dependencies already installed'
    return 0
  fi
  if [[ -f "$PROJECT_DIR/package-lock.json" ]]; then
    run npm ci --no-audit --no-fund
  else
    run npm install --no-audit --no-fund
  fi
  step "recording dependency stamp in $stamp"
  /usr/bin/time -p /usr/bin/printf '%s' "$current" > "$stamp"
}

build_output() {
  if [[ -f "$PROJECT_DIR/package.json" ]] && node -e 'const p=require("./package.json");process.exit(p.scripts&&p.scripts.build?0:1)'; then
    run npm run build
  elif [[ -f "$SRC_DIR/index.html" ]]; then
    if [[ -f "$OUT_DIR/index.html" && -z "$(find "$SRC_DIR" -newer "$OUT_DIR/index.html" -print -quit)" ]]; then
      step 'dist is up to date'
      return 0
    fi
    step "building $OUT_DIR from $SRC_DIR"
    run rm -rf "$OUT_DIR.new"
    run mkdir -p "$OUT_DIR.new"
    run cp -R "$SRC_DIR/." "$OUT_DIR.new/"
    run rm -rf "$OUT_DIR"
    run mv "$OUT_DIR.new" "$OUT_DIR"
  elif [[ -f "$OUT_DIR/index.html" ]]; then
    step 'no src/index.html; reusing existing dist'
  else
    step "error: no buildable source at $SRC_DIR/index.html" >&2
    return 1
  fi
  if [[ ! -f "$OUT_DIR/index.html" ]]; then
    step "error: build did not produce $OUT_DIR/index.html" >&2
    return 1
  fi
  step "build ready: $OUT_DIR/index.html"
}

write_deployment_output() {
  step "writing $META_DIR/deployment-output.json"
  run mkdir -p "$META_DIR"
  /usr/bin/time -p /usr/bin/printf '{"project":"%s","directory":"%s"}\n' "$PROJECT_DIR" "$OUT_DIR" > "$META_DIR/deployment-output.json"
  step "deployment-output = {\"project\":\"$PROJECT_DIR\",\"directory\":\"$OUT_DIR\"}"
}

serve_foreground() {
  step "serving $OUT_DIR at http://0.0.0.0:$PORT (foreground)"
  if command -v python3 >/dev/null 2>&1; then
    /usr/bin/time -p python3 -m http.server --bind 0.0.0.0 --directory "$OUT_DIR" "$PORT"
  else
    /usr/bin/time -p node -e '
      const http = require("http"), fs = require("fs"), path = require("path");
      const root = process.argv[1], port = Number(process.argv[2]);
      const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".ico": "image/x-icon" };
      http.createServer((req, res) => {
        const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        let file = path.resolve(root, "." + pathname);
        if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end("Forbidden"); return; }
        fs.stat(file, (error, stat) => {
          if (error || stat.isDirectory()) file = path.join(root, "index.html");
          fs.readFile(file, (readError, data) => {
            if (readError) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not found"); return; }
            res.writeHead(200, { "Content-Type": mime[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
            res.end(data);
          });
        });
      }).listen(port, "0.0.0.0");
    ' "$OUT_DIR" "$PORT"
  fi
}

install_dependencies
build_output
write_deployment_output
serve_foreground
