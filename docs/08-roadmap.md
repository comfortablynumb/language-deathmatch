# 8. Roadmap

## Phase 1 — Foundations + Fibonacci ✅

- [x] Planning docs (this folder)
- [x] Catalog: languages, categories, levels
- [x] Fibonacci spec + implementations: Go, Rust, C++, Assembly, Python, JavaScript
- [x] `ldm catalog`: manifest validation + site data generation
- [x] `ldm bench` + `ldmmeasure`: Docker build, verification, in-container measurement, results
- [x] Website: home/explorer, project (overview, code, compare, benchmarks), leaderboard,
      languages, methodology, 404
- [x] CI: tests, catalog validation, per-language verification; benchmarks + GitHub Pages deploy

## Phase 1.5 — Language Deathmatch ✅

Planned and delivered milestone by milestone in [milestones/](milestones/README.md):

- [x] M1 Rebrand to Language Deathmatch (names, tools `ldm`/`ldmmeasure`/`ldmexec`, image tags, logo)
- [x] M2 Fighter and arena profiles in the catalog; `benchmarks` + `loc` in `catalog.json`
- [x] M3 Fight engine: arenas, rules of combat, standings, towers, climbs, fight script, player (unit tested)
- [x] M4 Arena roster: primes-sieve, fasta, binary-trees, mandelbrot in all six languages
- [x] M5 Deathmatch UI: select, tower, animated fight, rankings, fighters page, home integration
- [x] M6 Launch: full benchmark run, browser QA, docs

## Phase 2 — More CLI projects 🔜

- [ ] Level 1–2 projects: fizzbuzz, collatz, word-frequency, matrix-multiply (primes-sieve and fasta ✅)
- [ ] Level 3 projects: n-body, json-aggregate, game-of-life (binary-trees and mandelbrot ✅)
- [ ] Projects reading stdin/files (`stdinFile` in benchmark cases)
- [ ] Build time and binary size metrics
- [ ] Results history (persisted per run) + trend charts
- [ ] Variants: optional `optimized` implementation next to the idiomatic one
- [ ] Light theme

## Phase 3 — Servers 🔜

- [ ] `server` project kind: readiness probe + load generator container
- [ ] Metrics: requests/s, latency percentiles, error rate, peak memory, time to first response
- [ ] Projects: http-hello, rest-api-memory, websocket-echo, parallel-sum (concurrency)
- [ ] Site: server benchmark view (throughput & latency charts)
- [ ] Deathmatch: open the Concurrency and Web arenas (requests/s and latency rounds)

## Phase 4 — Systems with dependencies 🔜

- [ ] `stack` project kind with Docker Compose (PostgreSQL, Redis) + `bin/up.sh` / `bin/down.sh`
- [ ] Database migrations with dbmate (`amacneil/dbmate:2.28.0`)
- [ ] Projects: todo-api-postgres, url-shortener, kv-store

## Phase 5 — Breadth 🔜

- [ ] More languages: Java, C#, Kotlin, Zig, C, Ruby, PHP, TypeScript (Deno/Bun), Elixir, Haskell
- [ ] Expert projects: lox-interpreter, ray-tracer
- [ ] PR benchmark diff comments
