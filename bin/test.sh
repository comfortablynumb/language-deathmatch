#!/usr/bin/env bash
# Runs every unit test: Go tools (vet + test) and the site's pure JavaScript modules.
# Usage: bin/test.sh
set -euo pipefail
cd "$(dirname "$0")/.."

(cd tools && go vet ./... && go test ./...)
npm test
