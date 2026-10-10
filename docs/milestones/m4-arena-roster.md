# M4 — Arena roster: four new projects

**Status:** ✅ Done · **Depends on:** M1 · **Unblocks:** M6

## Goal

"Choose your arena" only means something if several arenas are open. Today only
*Algorithms & Math* has a project (Fibonacci). This milestone adds four `cli` projects — all
implemented in **Go, Rust, C++, Assembly, Python and JavaScript**, verified byte for byte in
Docker — so four arenas are open and the algorithms arena gets a second project.

| Project | Arena (category) | Level | Exercises | Output |
|---------|------------------|-------|-----------|--------|
| `primes-sieve` | Algorithms & Math | 2 | byte array, strided writes, scan | 3 short lines |
| `fasta` | Text & Data Processing | 2 | LCG, cumulative lookup, line formatting, buffered output | text, ~10 bytes × N |
| `binary-trees` | Data Structures & Memory | 3 | allocation, recursion, GC / allocator pressure | text summary |
| `mandelbrot` | Simulation & Graphics | 3 | double-precision floating point, bit packing | binary PBM |

Arenas *Concurrency*, *Web* and *Systems* stay **locked** until `server`/`stack` project kinds
exist (roadmap Phase 3–4); the UI says so instead of faking fighters.

## Common contract (all four)

Same as Fibonacci, so the existing tooling needs no change:

- One argument made only of ASCII digits (leading zeros allowed) within the project's range.
  Missing/extra arguments, any other character, or out of range → usage on **stderr**, nothing on
  stdout, exit code **1**.
- Output on stdout, buffered; exit code 0.
- Standard library only, idiomatic code, release builds with each language's usual flags,
  single-threaded, `FROM` the language's pinned image, `ENTRYPOINT` = the program.
- Verification: exact `stdout` for short outputs, `sha256` otherwise. Expected values come from a
  reference implementation and must be reproduced by all six.
- Two benchmark cases: a small one (startup + a little work) and a large one sized so CPython
  stays around 1–4 s per run (CI runs every case ~15 times).

## `primes-sieve` — Sieve of Eratosthenes

- **Input:** `N`, `0 ≤ N ≤ 200000000`.
- **Output:** three lines: `count: C`, `sum: S`, `largest: P` — the number of primes ≤ N, their
  sum (fits in 64 bits for the allowed range) and the largest prime ≤ N (`0` when there is none).
- **Rules:** one byte (or `bool`) flag per integer `0..N` — no bit packing, odd-only layout, wheels
  or segmentation. For `p = 2, 3, …` while `p × p ≤ N`: if `p` is still marked prime, cross off
  `p×p, p×p+p, …`. Then scan the flags. Python may cross off with slice assignment and scan with
  `itertools.compress` (the idiomatic built-ins for the same algorithm).
- **Verify:** 0, 1, 2, 10, 100, 1000000, leading zeros, and the six usage errors (too large = 200000001).
- **Benchmarks:** `N = 1000000` and `N = 100000000`.

## `fasta` — generate DNA sequences

The Computer Language Benchmarks Game program, sequential.

- **Input:** `N`, `0 ≤ N ≤ 25000000`.
- **Output:** three FASTA records, each sequence wrapped at **60** characters per line (the last line
  may be shorter; no empty lines):
  1. `>ONE Homo sapiens alu` — the 287-character ALU string repeated cyclically, `2N` characters.
  2. `>TWO IUB ambiguity codes` — `3N` random characters from the IUB table.
  3. `>THREE Homo sapiens frequency` — `5N` random characters from the Homo sapiens table
     (the generator state continues from record 2).
- **Random generator:** `seed = (seed × 3877 + 29573) mod 139968`, starting at 42;
  `r = seed / 139968.0` (double). Pick the **first** table entry whose cumulative probability
  (running double sum of the probabilities, in table order) is **greater than** `r`; if none, the
  last entry. One generator step per character; no tables precomputed per seed.
  A linear scan or the standard library's binary search over the cumulative table are both allowed.
- **Verify:** 0, 1, 10, 1000 (`sha256`), leading zeros and the usage errors (too large = 25000001).
- **Benchmarks:** `N = 1000` and `N = 2500000` (25.4 MB of output; first sized at 500 000, which
  kept CPython under 0.5 s and the compiled languages around 50 ms — too short to separate them).

## `binary-trees` — allocate, walk, discard

The Computer Language Benchmarks Game program, sequential.

- **Input:** `N`, `0 ≤ N ≤ 21`. `maxDepth = max(6, N)`, `minDepth = 4`.
- **Output:**
  1. `stretch tree of depth {maxDepth+1}\t check: {c}` — built, checked and dropped first;
  2. a long-lived tree of depth `maxDepth` is built and kept alive while
  3. for `depth = 4, 6, …, ≤ maxDepth`: `iterations = 2^(maxDepth − depth + 4)` trees of that depth
     are built, checked and dropped one at a time: `{iterations}\t trees of depth {depth}\t check: {sum}`;
  4. `long lived tree of depth {maxDepth}\t check: {c}`.
- **Tree:** a node has two child references (none for leaves); `tree(0)` is a leaf,
  `tree(d)` has children `tree(d−1)`, `tree(d−1)`. `check` = number of nodes (1 + left + right).
- **Rules:** one heap allocation per node where the language has a general-purpose allocator
  (`Box`, `std::unique_ptr`, GC objects, tuples). Assembly has no libc allocator, so it carves nodes
  from its own `mmap`'d arena, released after each tree (documented in its notes). No memory pools in
  the other languages, no threads.
- **Verify:** 0, 6, 10, 12 (exact stdout), leading zeros and the usage errors (too large = 22).
- **Benchmarks:** `N = 10` and `N = 16` (~14.6 million nodes; first sized at 14, where CPython took
  only 0.2 s).

## `mandelbrot` — render a fractal bitmap

The Computer Language Benchmarks Game program, sequential, with the arithmetic order fixed so all
languages produce identical bits.

- **Input:** `N`, `1 ≤ N ≤ 16000` (image is N × N).
- **Output:** binary PBM: `P4\n{N} {N}\n` then the rows, top to bottom, 1 bit per pixel MSB first,
  each row padded with zero bits to a whole byte. A pixel is `1` when it stays in the set.
- **Per pixel** (all IEEE-754 doubles, evaluated exactly in this order):
  `cr = 2.0*x/N - 1.5`, `ci = 2.0*y/N - 1.0`; `zr = zi = tr = ti = 0`;
  up to **50** iterations while `tr + ti <= 4.0`: `zi = 2.0*zr*zi + ci; zr = tr - ti + cr;
  tr = zr*zr; ti = zi*zi`; the pixel is in the set when `tr + ti <= 4.0` afterwards.
- **Rules:** no fused multiply-add (compiled languages keep the default x86-64 baseline without
  FMA; C++ adds `-ffp-contract=off` to make it explicit), no complex-number types (they change the
  operation order), no cardioid/bulb or periodicity shortcuts, no hand-written SIMD, no threads.
- **Verify:** 1, 8, 200, 1000 (`sha256`), leading zeros, `0` and the usage errors (too large = 16001).
- **Benchmarks:** `N = 200` and `N = 1000` (~24 million iterations; first sized at 600, where CPython
  took only 0.7 s).

## Per-language notes to honor

| Language | Notes |
|----------|-------|
| Go | `bufio.Writer` (64 KiB); `GOAMD64` default (v1) so no FMA fusion |
| Rust | `BufWriter` on locked stdout; `Box<Node>` with `Option` children; musl allocator is part of the pinned toolchain |
| C++ | `-std=c++23 -O2 -static`; `std::unique_ptr` nodes; `-ffp-contract=off` for mandelbrot |
| Assembly | NASM, raw syscalls (`write`, `exit`, `mmap`, `munmap`), own output buffer; SSE2 scalar doubles |
| Python | `main()` + type hints; `bytearray`/`bytes` for binary output; tuples for tree nodes |
| JavaScript | CommonJS, `'use strict'`; `Buffer`/`Uint8Array` for binary output; respect stdout back-pressure |

## Process (per project)

1. Write `docs/projects/<id>.md` (goal, input, output, errors, rules, verification and benchmark cases).
2. Reference implementation (Go) → compute every expected `stdout` / `sha256`.
3. `projects/<id>/project.json`, then the six implementations with `impl.json` + `Dockerfile`.
4. `bin/bench.sh -verify-only -project <id>` until all six pass.
5. Add the project to [02-catalog](../02-catalog.md) (✅) and [docs/README](../README.md).

## Acceptance criteria

- `ldm catalog` validates all five projects; `bin/bench.sh -verify-only` passes for all 30
  implementations.
- A full `bin/bench.sh` produces results for every case; arenas *Algorithms*, *Text*, *Data
  Structures* and *Simulation* are open on the site with six fighters each.
