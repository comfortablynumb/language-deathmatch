#!/usr/bin/env bash
# Serves the static site on http://localhost:${1:-8080} (data must exist: run bin/build.sh first).
# Usage: bin/serve.sh [port]
set -euo pipefail
cd "$(dirname "$0")/.."

port="${1:-8080}"
python="$(command -v python3 || command -v python)"
echo "Language Deathmatch on http://localhost:${port}"
"$python" -m http.server "$port" --directory site --bind 127.0.0.1
