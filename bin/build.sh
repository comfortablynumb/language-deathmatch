#!/usr/bin/env bash
# Validates the manifests, generates site/data/{catalog.json,projects/*.json} and builds the CSS.
# Usage: bin/build.sh
set -euo pipefail
cd "$(dirname "$0")/.."

(cd tools && go run ./cmd/ldm catalog -root .. -out ../site/data)

if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund
fi

npm run build:css
