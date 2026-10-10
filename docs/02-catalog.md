# 2. Project Catalog

Every project has exactly **one category**, exactly **one complexity level** (1–5) and any number
of **tags**. Categories and levels are defined once in `catalog/categories.json` and
`catalog/levels.json`; the website reads them from the generated catalog, so adding a category
needs no site changes.

## Categories (arenas)

Every category is also a [deathmatch](10-deathmatch.md) **arena**, with a stage name, a tagline and
a color (`arena` in `catalog/categories.json`). An arena opens as soon as two languages have
results for one of its projects.

| Id | Name | Arena | Focus | Typical metrics | Arena status |
|----|------|-------|-------|-----------------|--------------|
| `algorithms` | Algorithms & Math | The Number Pit | CPU-bound integer / numeric computation, tight loops | wall time, CPU time | ✅ open |
| `data-structures` | Data Structures & Memory | The Heap | Allocation, GC pressure, pointer chasing, hash maps | wall time, peak memory | ✅ open |
| `text-processing` | Text & Data Processing | The Scriptorium | Parsing, string handling, file/stdin I/O, JSON, CSV | wall time, throughput | ✅ open |
| `simulation` | Simulation & Graphics | The Floating Point | Floating point, physics, rendering to image files | wall time | ✅ open |
| `concurrency` | Concurrency & Parallelism | The Thread Pit | Threads, async, channels, work distribution | wall time, CPU time, scaling | 🔜 locked |
| `web` | Web & Networking | The Request Gauntlet | HTTP servers, REST APIs, WebSockets | requests/s, latency percentiles, memory | 🔜 locked |
| `systems` | Systems & Services | The Datacenter | Multi-component apps with databases, caches, protocols | requests/s, latency, memory | 🔜 locked |

## Complexity levels

| Level | Name | Description | Expected scope |
|-------|------|-------------|----------------|
| 1 | **Trivial** | One function, a loop, stdout. Highlights startup cost and basic I/O. | < 50 lines |
| 2 | **Easy** | Standard collections, input parsing, simple algorithms. | 50–150 lines |
| 3 | **Medium** | Non-trivial algorithms, recursion, memory-heavy work, file formats. | 100–300 lines |
| 4 | **Hard** | Concurrency, networking, long-running servers, a framework or protocol. | 200–600 lines |
| 5 | **Expert** | Multi-service systems with external dependencies (DB, cache), or a full interpreter/engine. | 500+ lines |

The website renders the level as a badge with 1–5 filled pips and a color ramp
(green → red), and allows filtering by level.

## Tags

Free-form, lowercase, kebab-case. Recommended vocabulary (keep it small so filters stay useful):

| Tag | Meaning |
|-----|---------|
| `cpu-bound` | Dominated by computation |
| `io-bound` | Dominated by reading/writing |
| `memory` | Allocation or memory footprint is the main concern |
| `startup` | Runtime startup time is a large part of the measurement |
| `integer-arithmetic` / `floating-point` | Kind of math involved |
| `stdout` / `stdin` / `files` | I/O channel used |
| `loops` / `recursion` | Control-flow style mandated by the spec |
| `strings` / `parsing` / `json` | Text work |
| `concurrency` / `network` / `http` / `database` | Runtime features exercised |

## Project kinds

| Kind | How it runs | Status |
|------|-------------|--------|
| `cli` | A process started with arguments; its output is verified and its runs are timed | ✅ Done |
| `server` | A long-running HTTP server; a load generator container measures throughput & latency | 🔜 Planned |
| `stack` | A server plus dependencies (PostgreSQL, Redis…) started with Docker Compose | 🔜 Planned |

## Projects

Five projects are implemented (✅) in all eleven languages; the rest is the backlog, ordered by level.
Assembly is expected to cover levels 1–3 only; higher levels show "not implemented" for it.

| Project | Category | Level | Kind | Tags | Status |
|---------|----------|-------|------|------|--------|
| [fibonacci](projects/fibonacci.md) | algorithms | 1 | cli | cpu-bound, integer-arithmetic, loops, stdout, startup | ✅ |
| fizzbuzz | algorithms | 1 | cli | loops, stdout, strings, startup | 🔜 |
| collatz | algorithms | 1 | cli | cpu-bound, integer-arithmetic, loops | 🔜 |
| [primes-sieve](projects/primes-sieve.md) | algorithms | 2 | cli | cpu-bound, memory, loops, integer-arithmetic | ✅ |
| [fasta](projects/fasta.md) | text-processing | 2 | cli | strings, stdout, floating-point, io-bound | ✅ |
| word-frequency | text-processing | 2 | cli | stdin, strings, parsing, io-bound | 🔜 |
| matrix-multiply | algorithms | 2 | cli | cpu-bound, floating-point | 🔜 |
| [binary-trees](projects/binary-trees.md) | data-structures | 3 | cli | memory, recursion, allocation, garbage-collection, pointer-chasing | ✅ |
| n-body | simulation | 3 | cli | cpu-bound, floating-point | 🔜 |
| [mandelbrot](projects/mandelbrot.md) | simulation | 3 | cli | cpu-bound, floating-point, bit-packing, binary-output, stdout | ✅ |
| json-aggregate | text-processing | 3 | cli | json, parsing, files | 🔜 |
| game-of-life | simulation | 3 | cli | cpu-bound, memory | 🔜 |
| parallel-sum | concurrency | 4 | cli | concurrency, cpu-bound | 🔜 |
| http-hello | web | 4 | server | http, network, startup | 🔜 |
| rest-api-memory | web | 4 | server | http, json, network | 🔜 |
| websocket-echo | web | 4 | server | network, concurrency | 🔜 |
| todo-api-postgres | systems | 5 | stack | http, json, database | 🔜 |
| url-shortener | systems | 5 | stack | http, database, network | 🔜 |
| kv-store | systems | 5 | server | network, concurrency, parsing | 🔜 |
| lox-interpreter | text-processing | 5 | cli | parsing, recursion, memory | 🔜 |
| ray-tracer | simulation | 5 | cli | floating-point, files, cpu-bound | 🔜 |

Each project gets its own spec in `docs/projects/<id>.md` before any implementation starts.
