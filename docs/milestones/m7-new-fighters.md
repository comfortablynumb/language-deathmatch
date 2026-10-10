# M7 — New fighters: C, Zig, V, Java, Haskell

**Status:** ✅ Done · **Depends on:** M1–M6

## Goal

Five more languages enter every open arena: **C, Zig, V, Java and Haskell**. Each implements all
five projects (25 new implementations), passes every verification case in Docker, gets a fighter
profile, and is benchmarked like the others. No engine or site change is needed beyond
syntax highlighting and layouts that must fit 11 fighters.

## Roster

| Id | Language | Kind | Toolchain | Build image (pinned `image`) | Runtime image | Release build |
|----|----------|------|-----------|------------------------------|---------------|---------------|
| `c` | C | compiled | GCC 16.2 (C23) | `gcc:16.2-trixie` | `scratch` | `gcc -std=c23 -O2 -static -s` |
| `zig` | Zig | compiled | Zig 0.16.0 | `alpine:3.24` + `apk add zig` (0.16.0) | `scratch` | `zig build-exe -O ReleaseFast -mcpu baseline` (static, no libc; baseline x86-64 like the others) |
| `v` | V | compiled | V 0.5.2 | `alpine:3.24` + V built from the `0.5.2` tag (`vc` and `tccbin` pinned to matching commits, `make local=1`) | `scratch` (static musl) | `v -prod -cflags "-static -s"` |
| `java` | Java | jit | OpenJDK 25 (Temurin) | `eclipse-temurin:25-jdk-alpine` | `eclipse-temurin:25-jre-alpine` | `javac`, run with `java -cp` |
| `haskell` | Haskell | compiled | GHC 9.14.1 | `haskell:9.14` | `scratch` (fully static) | `ghc -O2 -static -optl-static -optl-pthread` + `strip` |

The first `FROM` of every Dockerfile must equal the pinned image (validated by `ldm catalog`), so
every project of a language uses the same toolchain. Zig and V have no versioned official images:
their toolchains are pinned by Alpine package version (Zig) and git tag (V).

## Fighter profiles

| Language | Color | Glyph | Nickname | Special (≥ 5× blows) | Fatality | Quote |
|----------|-------|-------|----------|----------------------|----------|-------|
| C | `#A8B9CC` | C | The Elder | Pointer Arithmetic | Buffer Overflow | Everything you run was written in me. |
| Zig | `#F7A41D` | Zg | The Ziguana | Comptime Crush | Unreachable | No hidden control flow. No hidden mercy. |
| V | `#5D87BF` | V | The Speedrunner | Instant Compile | Autofree | Compiled before you blinked. |
| Java | `#B07219` | Jv | The Enterprise | JIT Warmup Uppercut | NullPointerException | Write once, win anywhere. |
| Haskell | `#8F4E8B` | Hs | The Pure One | Point-Free Strike | Monadic Bind | Pure. Lazy. Undefeated. |

## Per-language conventions

| Language | Conventions |
|----------|-------------|
| C | C23, `<stdint.h>` fixed-width types, `stdio` with a large `setvbuf` buffer, `strtoull` only after validating digits, errors to `stderr` + `return 1`; binary-trees: one `malloc` per node, `free` after each tree |
| Zig | Zig 0.16 standard library only; buffered stdout writer, `+%` for wrapping `u64`; binary-trees: one allocation per node from a general-purpose allocator (no arena); `ReleaseFast` without fast-math |
| V | V standard library only; `strings.Builder` / buffered output, `u64` wraps; binary-trees: `&Node{}` per node (V's default GC); `-prod` |
| Java | Java 25, one class in the default package, `BufferedOutputStream`/`PrintStream` with a large buffer; `long` wraps (printed with `Long.toUnsignedString`); binary-trees: one object per node |
| Haskell | GHC 9.14, `base` plus GHC's boot packages (`bytestring`, `array`), `Data.ByteString.Builder` for output, `Word64` wraps; binary-trees: a data type with strict fields; mandelbrot: plain `Double` arithmetic in the mandated order |

Shared rules from [M4](m4-arena-roster.md) apply unchanged: same algorithm, same argument
validation and usage errors, standard library only, single-threaded, buffered output, no FMA in
mandelbrot (C adds `-ffp-contract=off`; Zig keeps strict float mode; Java never contracts;
GHC emits no FMA; V must not pass `-march=native`).

## Syntax highlighting

- C and Java are in the highlight.js common bundle already loaded by the site.
- Haskell: load `languages/haskell.min.js` 11.11.1 from cdnjs with its SRI hash.
- Zig and V have no highlight.js grammar: `.zig` and `.v` map to the **Rust** grammar, whose
  keywords (`fn`, `pub`, `const`, `mut`, `struct`, `match`, `return`), strings, comments and numbers
  cover theirs closely. The mapping lives in `tools/internal/catalog/highlight.go`.

## Site adjustments for 11 fighters

- Select screen portrait grid: 3 columns on phones, 6 on desktop → two rows (6 + 5).
- Home hero roster: 4 columns; checked at 360 px and desktop.
- Rankings matrix 11 × 11 scrolls horizontally inside its card (already supported).

## Process

1. Catalog entries + highlighting first (this milestone), so `ldm catalog` validates new folders.
2. One implementer per language writes its five projects, mirroring the existing implementations
   of the same project and the language's conventions above, and iterates until
   `ldm bench -verify-only -lang <id>` passes every case.
3. Full `bin/bench.sh` run, sanity check of the arenas, browser QA, docs (06-languages, project
   specs' language lists, README).

## Outcome

- 55 / 55 implementations verified and benchmarked locally (`-cpuset 1`); every open arena has 11
  fighters. Browser QA at 1366 px and 360 px: 11 portraits, towers of 10 opponents, an 11 × 11
  head-to-head matrix, highlighting for every language, no horizontal scroll, no console errors.
- **Harness fix found by Java:** in memory mode `ldmexec` killed programs that re-execute themselves
  (the JDK launcher on musl does, to set `LD_LIBRARY_PATH`). It now traces exec events
  (`PTRACE_O_TRACEEXEC`) — see [05-benchmarking](../05-benchmarking.md#exact-peak-memory).
- **Zig** builds with `-mcpu baseline`: without it Zig targets the build host's CPU (AVX), unlike the
  other compiled languages.
- **V** pins its C bootstrap (`vc`) and `tccbin` to the commits matching the `0.5.2` tag (`make`
  would otherwise fetch newer ones that reject the tag's sources). V keeps its default bounds checks,
  which cost ~2× on the primes sieve — no language opts out of its defaults.
- **Haskell** binary-trees compiles with `-fno-full-laziness -fno-cse`: otherwise GHC hoists the
  loop-invariant tree out of the loop and shares identical subtrees, so trees would not really be
  allocated. Its Mandelbrot is ~2–3× slower than GCC/LLVM output (GHC's native code generator).
- **Java** keeps default JVM settings; its peak memory reflects the JVM's heap sizing (G1 with
  several CPUs, Serial when pinned to one).

## Acceptance criteria

- `ldm catalog` validates 11 languages; `bin/bench.sh -verify-only` passes for all 55
  implementations; `bin/test.sh` green.
- A full benchmark run publishes results for every case; every open arena has 11 fighters.
- Select, tower, fight, rankings and fighters pages render 11 fighters at 360 px and desktop with
  no horizontal page scroll and no console errors.
