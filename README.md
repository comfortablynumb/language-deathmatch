# Language Deathmatch

**Choose your fighter. Choose your arena. Fight every other language — on real benchmarks.**

Language Deathmatch implements the **same applications in many languages**, verifies them byte for
byte and **benchmarks them in Docker**, then turns the numbers into an arcade fighting game: pick a
language, pick a type of problem (an *arena*), and climb a tower where your language fights every
other language one after another. Every blow is a real measurement; nothing is random.

- Fighters (11): **Go, Rust, C++, C, Assembly (x86-64 NASM), Zig, V, Java, Haskell, Python, JavaScript (Node.js)**.
- Arenas (project categories): **Algorithms & Math** (Fibonacci, primes sieve), **Text & Data
  Processing** (fasta), **Data Structures & Memory** (binary trees), **Simulation & Graphics**
  (Mandelbrot); Concurrency, Web and Systems are locked until their project kinds exist.
- Website: jQuery + Tailwind CSS + Apache ECharts + highlight.js, no framework or bundler.

Planning and design documents live in [`docs/`](docs/README.md); the deathmatch was built in six
[milestones](docs/milestones/README.md).

## How a fight works

| | |
|---|---|
| **Arena** | A project category. Only implementations that passed verification fight. |
| **Round 1 · Speed** | One blow per benchmark case: the lower median wall time hits. |
| **Round 2 · Memory** | One blow per benchmark case: the lower median peak memory hits. |
| **Round 3 · Brevity** | Only at 1–1: lines of code per project (fewer wins). |
| **Damage** | `50 × log2(ratio) ÷ blows in the round`, 1 to 100; ratios under 1.05× are **blocked** (noise). |
| **Round** | 100 health each; less damage taken wins. **K.O.** at 0, **flawless** when untouched. |
| **Match** | Best of three. **Fatality**: a final-round K.O. finished by a ≥ 10× blow. |
| **Tower** | Every other fighter of the arena, weakest first; the arena's strongest is the boss. Lose and you may **Continue?** |

A round goes to the fighter that is better on the geometric mean of the ratios — the same statistic
as the leaderboard — so the drama never contradicts the numbers. Example commentary (Rust vs
JavaScript in The Floating Point, from the local run below):

```
Round 2 · Memory: median peak memory of every benchmark case.
Rust — Borrow Checker Slam · Mandelbrot › 200 × 200: 304 KiB vs 52.7 MiB (177× leaner) · critical · −100
Finish them!
Rust — Lifetime Expired · Mandelbrot › 1000 × 1000: 272 KiB vs 53.6 MiB (202× leaner) · critical · −100
Fatality! Rust performs Lifetime Expired.
Rust wins 2–0 against JavaScript by fatality.
```

Full rules: [docs/10-deathmatch.md](docs/10-deathmatch.md) (also on the site's Methodology page).

## Features

| Area | What you get |
|------|--------------|
| Deathmatch | Fighter + arena select, tower climb with continues (progress kept in your browser), animated fights (health bars, K.O., FINISH THEM!, fatalities) with a blow-by-blow log, skip / replay / 2× speed, reduced-motion support |
| Arena rankings | Round-robin standings (W–L, rounds, fatalities, flawless rounds) and a head-to-head matrix linking every fight |
| Fighters | Profiles (nickname, special move, fatality, quote), arena titles, toolchain, leaderboard rank |
| Project explorer | Search, filter by category / level / language, sort; filters live in the URL |
| Code | Highlighted sources and build files per language, line numbers, copy button, notes |
| Compare | Any two languages side by side + head-to-head table ("Rust 80.7× faster") |
| Benchmarks | Ranked median chart, box plot of every run, sortable table, linear/log scale, wall time / CPU time / peak memory, lines of code, image size, verification status, environment |
| Leaderboard | Geometric mean of "times slower than the winner" across all cases |
| Methodology | How every number is produced, and how fights are scored |

Shareable routes: `#/deathmatch?fighter=rust&arena=algorithms` (select), `#/deathmatch/algorithms`
(rankings), `#/deathmatch/algorithms/rust` (tower), `#/deathmatch/algorithms/rust/go` (a fight).

## Quick start

Requirements: Docker, Go ≥ 1.25, Node.js ≥ 22, Python 3 (only for `bin/serve.sh`).

```bash
bin/build.sh                 # validate manifests, generate site/data, build CSS
bin/bench.sh                 # build + verify + benchmark everything → site/data/results.json
bin/serve.sh 8080            # open http://localhost:8080 → Deathmatch
bin/test.sh                  # Go + JavaScript unit tests
```

Useful variants:

```bash
bin/bench.sh -verify-only -lang rust             # only build images and check outputs
bin/bench.sh -project fibonacci -lang go,asm     # benchmark a subset (overwrites results.json)
bin/bench.sh -cpuset 1 -out /tmp/results.json    # pin containers to CPU 1, write elsewhere
docker run --rm deathmatch/fibonacci-asm 10      # run any implementation directly
docker run --rm deathmatch/mandelbrot-rust 400 > m.pbm   # Mandelbrot as a PBM image
```

## How benchmarks work

1. `docker build` each `projects/<project>/<language>/Dockerfile` (`FROM` the language's pinned
   image in `catalog/languages.json`).
2. Run every **verification case** of the project (`docker run --network none`); exit code and
   stdout must match exactly (text or SHA-256). Failing implementations are not benchmarked.
3. Inside the container, the harness (`ldmmeasure` + the tiny `ldmexec` launcher, mounted read-only)
   runs one hashed verification run, warmups, **timed runs** (wall + CPU time) and **memory runs**
   (exact peak RSS read just before exit, because Linux ≥ 6.2 RSS counters are approximate).
4. Results (all raw samples + quartiles, environment, commit) go to `site/data/results.json`; the
   site computes rankings and fights from it.

Details: [docs/05-benchmarking.md](docs/05-benchmarking.md).

### Example: arena standings, local run (Intel Core Ultra 9 285K, WSL2, `-cpuset 1`)

| Arena | Projects | Round-robin standings (W–L) |
|-------|----------|-----------------------------|
| The Number Pit (Algorithms & Math) | Fibonacci, Primes Sieve | Assembly 10–0 · Zig 9–1 · Rust 8–2 · C 6–4 · V 6–4 · C++ 5–5 · Go 4–6 · Haskell 4–6 · Python 2–8 · JavaScript 1–9 · Java 0–10 |
| The Heap (Data Structures & Memory) | Binary Trees | Assembly 10–0 · Haskell 8–2 · C 7–3 · C++ 6–4 · Zig 6–4 · V 6–4 · Rust 5–5 · Go 4–6 · Python 2–8 · JavaScript 1–9 · Java 0–10 |
| The Scriptorium (Text & Data Processing) | Fasta | Assembly 10–0 · Rust 9–1 · Zig 8–2 · V 7–3 · C 6–4 · C++ 5–5 · Go 4–6 · Haskell 3–7 · Python 2–8 · Java 1–9 · JavaScript 0–10 |
| The Floating Point (Simulation & Graphics) | Mandelbrot | Rust 10–0 · Zig 9–1 · V 8–2 · C 7–3 · C++ 6–4 · Assembly 5–5 · Go 4–6 · Haskell 3–7 · Python 2–8 · JavaScript 1–9 · Java 0–10 |

Why Java and JavaScript finish below Python despite out-running it on speed: they win the Speed
round but lose Memory (the JVM's and V8's default heaps vs CPython's ~9–25 MiB) and Brevity, so
Python takes those matches 2–1. Median wall time of each project's large case:

| Language | Binary trees (depth 16) | Mandelbrot (1000²) | Fasta (2.5 M) | Primes sieve (100 M) | Fibonacci (2 M) |
|----------|------------------------:|-------------------:|--------------:|---------------------:|----------------:|
| Go | 279 ms | 34.6 ms | 219 ms | 506 ms | 27.0 ms |
| Rust | 305 ms | 32.5 ms | 215 ms | 489 ms | 118 ms |
| C++ | 118 ms | 34.4 ms | 210 ms | 482 ms | 55.9 ms |
| C | 92.8 ms | 33.6 ms | 212 ms | 477 ms | 67.9 ms |
| Assembly | 28.8 ms | 37.0 ms | 207 ms | 520 ms | 46.6 ms |
| Zig | 197 ms | 32.4 ms | 203 ms | 475 ms | 22.6 ms |
| V | 119 ms | 33.4 ms | 275 ms | 1.01 s | 49.2 ms |
| Java | 143 ms | 71.3 ms | 297 ms | 533 ms | 211 ms |
| Haskell | 57.0 ms | 96.1 ms | 292 ms | 529 ms | 44.0 ms |
| Python | 800 ms | 1.59 s | 1.92 s | 1.57 s | 283 ms |
| JavaScript | 174 ms | 63.8 ms | 329 ms | 545 ms | 124 ms |

The published site shows the CI numbers, which come from a different machine.

## Repository layout

```
catalog/        languages (+ fighter profiles), categories (+ arena profiles), complexity levels
projects/       <project>/project.json + one folder per language implementation
tools/          Go: ldm (catalog + bench CLI), ldmmeasure (harness); C: ldmexec (launcher)
site/           static website (index.html, assets/, data/ generated)
tests/site/     node --test unit tests for the site's pure JS modules (incl. the fight engine)
bin/            build.sh, bench.sh, serve.sh, test.sh
docs/           planning docs, deathmatch rules, milestones, project specs
.github/        ci.yml (tests + verification matrix), bench.yml (benchmarks + Pages deploy)
```

## Adding things

- **A project:** write `docs/projects/<id>.md`, add `projects/<id>/project.json`
  (spec, verification cases, benchmark cases with expected SHA-256), then implementations. Its
  category's arena gains new blows automatically.
- **An implementation:** `projects/<project>/<language>/` with sources, a `Dockerfile` whose
  `ENTRYPOINT` is the program, and `impl.json`:

  ```json
  {
    "notes": ["uint64 wraps natively"],
    "files": [
      { "path": "main.go", "role": "source" },
      { "path": "Dockerfile", "role": "build" }
    ]
  }
  ```

- **A language (fighter):** add it to `catalog/languages.json` (id, name, color, kind, toolchain,
  pinned image) with its `fighter` profile:

  ```json
  "fighter": { "glyph": "Zg", "nickname": "The Lizard", "special": "Comptime Crush",
               "fatality": "Unreachable Code", "quote": "No hidden control flow. No hidden mercy." }
  ```

  CI picks it up automatically; it enters every arena where it has verified results.

Step by step: [docs/09-contributing.md](docs/09-contributing.md).

## CI / CD

- `ci.yml`: Go vet + tests, catalog validation, site tests + CSS build, and a per-language
  verification matrix generated from the catalog.
- `bench.yml`: on `main`, weekly and on demand, benchmarks everything on one runner
  (`-cpuset 1`), then deploys `site/` to GitHub Pages. Enable *Settings → Pages → Source: GitHub Actions*.

---

Language Deathmatch is a fan homage to arcade fighting games and is not affiliated with any of them.
