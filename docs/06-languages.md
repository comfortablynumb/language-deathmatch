# 6. Languages

## Roster

| Id | Language | Kind | Toolchain | Build image | Runtime image | Release build |
|----|----------|------|-----------|-------------|---------------|---------------|
| `go` | Go | compiled | Go 1.27 | `golang:1.27-alpine3.24` | `scratch` | `CGO_ENABLED=0 go build -trimpath -ldflags="-s -w"` |
| `rust` | Rust | compiled | Rust 1.99 | `rust:1.99-alpine3.24` | `scratch` | `cargo build --release` (`opt-level=3`, LTO, 1 codegen unit) |
| `cpp` | C++ | compiled | GCC 16.2 (C++23) | `gcc:16.2-trixie` | `scratch` | `g++ -std=c++23 -O2 -static` |
| `c` | C | compiled | GCC 16.2 (C23) | `gcc:16.2-trixie` | `scratch` | `gcc -std=c23 -O2 -static` |
| `asm` | Assembly | assembled | NASM (x86-64 Linux) | `alpine:3.24` + `nasm`, `binutils` | `scratch` | `nasm -f elf64` + `ld -s` |
| `zig` | Zig | compiled | Zig 0.16.0 | `alpine:3.24` + `zig` package | `scratch` | `zig build-exe -O ReleaseFast -mcpu baseline` |
| `v` | V | compiled | V 0.5.2 | `alpine:3.24` + V built from the `0.5.2` tag | `scratch` | `v -prod -cflags "-static -s"` (gcc `-O3 -flto`) |
| `java` | Java | jit | OpenJDK 25 (Temurin) | `eclipse-temurin:25-jdk-alpine` | `eclipse-temurin:25-jre-alpine` | `javac` |
| `haskell` | Haskell | compiled | GHC 9.14.1 | `haskell:9.14` | `scratch` | `ghc -O2 -static -optl-static -optl-pthread` + `strip` |
| `python` | Python | interpreted | CPython 3.14 | — | `python:3.14-slim-trixie` | — |
| `javascript` | JavaScript | jit | Node.js 24 LTS | — | `node:24-trixie-slim` | — |

Zig and V have no versioned official images: their toolchains are pinned by Alpine package version
(Zig) and git tag (V) on top of the pinned `alpine:3.24` image. V's `make` would fetch the latest
`vc` (its C bootstrap) and `tccbin`, so both are pinned to the commits matching the `0.5.2` tag and
`make` runs with `local=1`.

Brand colors (identity dots and chips next to language names; charts use one series hue, see
[Website](03-site.md#charts-and-color)): Go `#00ADD8`, Rust `#DEA584`, C++ `#659AD2`, C `#A8B9CC`,
Assembly `#9CA3AF`, Zig `#F7A41D`, V `#5D87BF`, Java `#B07219`, Haskell `#8F4E8B`,
Python `#3776AB`, JavaScript `#F7DF1E`.

## Fighters

Every language is also a [deathmatch](10-deathmatch.md) fighter (`fighter` in `catalog/languages.json`):

| Language | Glyph | Nickname | Special move (≥ 5× blows) | Fatality | Victory quote |
|----------|-------|----------|---------------------------|----------|---------------|
| Go | Go | The Gopher | Goroutine Barrage | Garbage Collected | Simple wins. Ship it. |
| Rust | Rs | The Crab | Borrow Checker Slam | Lifetime Expired | Fearless. Safe. Merciless. |
| C++ | C++ | The Template | Template Avalanche | Undefined Behavior | You only pay for what you use. You lose. |
| C | C | The Elder | Pointer Arithmetic | Buffer Overflow | Everything you run was written in me. |
| Assembly | ASM | The Bare Metal | Raw Syscall | Segmentation Fault | No runtime. No mercy. |
| Zig | Zg | The Ziguana | Comptime Crush | Unreachable | No hidden control flow. No hidden mercy. |
| V | V | The Speedrunner | Instant Compile | Autofree | Compiled before you blinked. |
| Java | Jv | The Enterprise | JIT Warmup Uppercut | NullPointerException | Write once, win anywhere. |
| Haskell | Hs | The Pure One | Point-Free Strike | Monadic Bind | Pure. Lazy. Undefeated. |
| Python | Py | The Serpent | Comprehension Coil | IndentationError | Readability counts. So does winning. |
| JavaScript | JS | The Event Loop | Callback Combo | undefined is not a function | I run everywhere. Even here. |

## Per-language conventions

| Language | Conventions |
|----------|-------------|
| Go | `package main`, standard library only, `bufio.Writer` for output, errors to `os.Stderr` + `os.Exit(1)` |
| Rust | Edition 2024, no crates unless the spec allows, `BufWriter` on locked stdout, `Result`-based errors |
| C++ | C++23, `<iostream>` with `std::ios::sync_with_stdio(false)`, `'\n'` (never `std::endl`), `std::from_chars` for parsing |
| C | C23, `<stdint.h>` / `<inttypes.h>` fixed-width types, digits validated before `strtoull`, fully buffered `stdio`, `malloc`/`free` per node in binary-trees |
| Assembly | NASM syntax, x86-64 System V Linux, raw syscalls only (no libc), own output buffer, comments on every block |
| Zig | Zig 0.16 standard library only, buffered stdout writer, `+%` wrapping `u64`, general-purpose allocator (one allocation per node, no arena), `ReleaseFast` without fast-math |
| V | V standard library only, output gathered in buffers and written in large chunks, `u64` wraps, `&Node{}` per node with V's default GC, `-prod` |
| Java | Java 25, one class `Main` in the default package, bytes through a large `BufferedOutputStream`, `long` wraps (printed with `Long.toUnsignedString`), one object per node, default JVM settings |
| Haskell | GHC 9.14.1, `base` + GHC boot packages (`bytestring`, `array`), `Data.ByteString.Builder` output, `Word64` wraps, strict fields / bang patterns where laziness would distort measurements |
| Python | Python 3 standard library, `main()` guarded by `if __name__ == "__main__"`, type hints, no C extensions |
| JavaScript | Node.js CommonJS, `'use strict'`, built-ins only, `BigInt` where 64-bit integers are required, respect stdout back-pressure |

64-bit unsigned arithmetic is native in Go, Rust, C++, C, Assembly, Zig (`+%`), V and Haskell
(`Word64`); Java adds `long`s (two's complement, so the bits wrap identically) and prints them with
`Long.toUnsignedString`; Python masks with `& (2**64 - 1)` and JavaScript uses `BigInt.asUintN(64, …)`.

## Syntax highlighting

highlight.js 11.11 covers every language except Zig and V, which have no grammar; their sources
use the Rust grammar (close keywords, strings, comments, numbers) — see
`tools/internal/catalog/highlight.go`. Haskell's grammar is loaded as a separate language pack.

## Architecture note

Assembly targets **x86-64 Linux**. Every image is built for `linux/amd64`; on ARM hosts
(Apple Silicon) Docker runs them through emulation, so local numbers there are not comparable
with CI numbers.

## 🔜 Planned languages

C# (.NET), Kotlin/JVM, Ruby, PHP, TypeScript (Deno/Bun), Elixir.
Adding one is described in [Contributing](09-contributing.md#add-a-language).
