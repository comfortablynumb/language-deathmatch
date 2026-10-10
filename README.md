# Language Deathmatch

**Choose your fighter. Choose your arena. Fight every other language — on real benchmarks.**

Language Deathmatch implements the **same applications in many languages**, verifies them byte for
byte and **benchmarks them in Docker**, then turns the numbers into an arcade fighting game: pick a
language, pick a type of problem (an *arena*), and climb a tower where your language fights every
other language one after another. Every blow is a real measurement; nothing is random.

- Fighters: **Go, Rust, C++, Assembly (x86-64 NASM), Python, JavaScript (Node.js)**.
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
Rust — Borrow Checker Slam · Mandelbrot › 200 × 200: 300 KiB vs 52.9 MiB (180× leaner) · critical · −100
Finish them!
Rust — Lifetime Expired · Mandelbrot › 1000 × 1000: 272 KiB vs 54.9 MiB (207× leaner) · critical · −100
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
| The Number Pit (Algorithms & Math) | Fibonacci, Primes Sieve | Assembly 5–0 · Rust 4–1 · Go 3–2 · C++ 2–3 · Python 1–4 · JavaScript 0–5 |
| The Heap (Data Structures & Memory) | Binary Trees | Assembly 5–0 · C++ 4–1 · Go 3–2 · Rust 2–3 · Python 1–4 · JavaScript 0–5 |
| The Scriptorium (Text & Data Processing) | Fasta | Assembly 5–0 · Rust 4–1 · C++ 3–2 · Go 2–3 · Python 1–4 · JavaScript 0–5 |
| The Floating Point (Simulation & Graphics) | Mandelbrot | Rust 5–0 · C++ 4–1 · Assembly 3–2 · Go 2–3 · Python 1–4 · JavaScript 0–5 |

Why JavaScript finishes last despite out-running Python on speed: it wins the Speed round but loses
Memory (Node's ~45–55 MiB baseline vs CPython's ~9–17 MiB) and Brevity, so Python takes those
matches 2–1. A selection of the medians behind the fights:

| Case | Assembly | Rust | C++ | Go | JavaScript | Python |
|------|---------:|-----:|----:|---:|-----------:|-------:|
| Binary trees, depth 16 | 28.6 ms | 329 ms | 130 ms | 299 ms | 192 ms | 876 ms |
| Mandelbrot 1000 × 1000 | 38.6 ms | 33.9 ms | 34.4 ms | 36.1 ms | 69.6 ms | 1.70 s |
| Fasta, N = 2.5 million | 221 ms | 232 ms | 229 ms | 235 ms | 363 ms | 2.06 s |
| Primes sieve, N = 100 million | 562 ms | 496 ms | 546 ms | 516 ms | 597 ms | 1.69 s |
| Fibonacci, N = 2 million | 49.4 ms | 124 ms | 58.2 ms | 28.2 ms | 138 ms | 307 ms |

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
