#!/usr/bin/env bash
# Builds, verifies and benchmarks implementations in Docker; writes site/data/results.json.
# Usage: bin/bench.sh [-project fibonacci] [-lang go,rust] [-verify-only] [-cpuset 1] [-out file]
set -euo pipefail
cd "$(dirname "$0")/.."

exe="$(cd tools && go env GOEXE)"
(cd tools && go build -o "../build/ldm${exe}" ./cmd/ldm)
"./build/ldm${exe}" bench "$@"
