# 6. Languages

## Initial roster

| Id | Language | Kind | Toolchain | Build image | Runtime image | Release build |
|----|----------|------|-----------|-------------|---------------|---------------|
| `go` | Go | compiled | Go 1.27 | `golang:1.27-alpine3.24` | `scratch` | `CGO_ENABLED=0 go build -trimpath -ldflags="-s -w"` |
| `rust` | Rust | compiled | Rust 1.99 | `rust:1.99-alpine3.24` | `scratch` | `cargo build --release` (`opt-level=3`, LTO, 1 codegen unit) |
| `cpp` | C++ | compiled | GCC 16.2 (C++23) | `gcc:16.2-trixie` | `scratch` | `g++ -std=c++23 -O2 -static` |
| `asm` | Assembly | assembled | NASM (x86-64 Linux) | `alpine:3.24` + `nasm`, `binutils` | `scratch` | `nasm -f elf64` + `ld -s` |
| `python` | Python | interpreted | CPython 3.14 | — | `python:3.14-slim-trixie` | — |
| `javascript` | JavaScript | jit | Node.js 24 LTS | — | `node:24-trixie-slim` | — |

Brand colors (identity dots and chips next to language names; charts use one series hue, see [Website](03-site.md#charts-and-color)): Go `#00ADD8`, Rust `#DEA584`, C++ `#659AD2`,
Assembly `#9CA3AF`, Python `#3776AB`, JavaScript `#F7DF1E`.

## Fighters

Every language is also a [deathmatch](10-deathmatch.md) fighter (`fighter` in `catalog/languages.json`):

| Language | Glyph | Nickname | Special move (≥ 5× blows) | Fatality | Victory quote |
|----------|-------|----------|---------------------------|----------|---------------|
| Go | Go | The Gopher | Goroutine Barrage | Garbage Collected | Simple wins. Ship it. |
| Rust | Rs | The Crab | Borrow Checker Slam | Lifetime Expired | Fearless. Safe. Merciless. |
| C++ | C++ | The Template | Template Avalanche | Undefined Behavior | You only pay for what you use. You lose. |
| Assembly | ASM | The Bare Metal | Raw Syscall | Segmentation Fault | No runtime. No mercy. |
| Python | Py | The Serpent | Comprehension Coil | IndentationError | Readability counts. So does winning. |
| JavaScript | JS | The Event Loop | Callback Combo | undefined is not a function | I run everywhere. Even here. |

## Per-language conventions

| Language | Conventions |
|----------|-------------|
| Go | `package main`, standard library only, `bufio.Writer` for output, errors to `os.Stderr` + `os.Exit(1)` |
| Rust | Edition 2024, no crates unless the spec allows, `BufWriter` on locked stdout, `Result`-based errors |
| C++ | C++23, `<iostream>` with `std::ios::sync_with_stdio(false)`, `'\n'` (never `std::endl`), `std::from_chars` for parsing |
| Assembly | NASM syntax, x86-64 System V Linux, raw syscalls only (no libc), own output buffer, comments on every block |
| Python | Python 3 standard library, `main()` guarded by `if __name__ == "__main__"`, type hints, no C extensions |
| JavaScript | Node.js CommonJS, `'use strict'`, built-ins only, `BigInt` where 64-bit integers are required, respect stdout back-pressure |

64-bit unsigned arithmetic is native in Go, Rust, C++ and Assembly; Python masks with
`& (2**64 - 1)` and JavaScript uses `BigInt.asUintN(64, …)`.

## Architecture note

Assembly targets **x86-64 Linux**. Every image is built for `linux/amd64`; on ARM hosts
(Apple Silicon) Docker runs them through emulation, so local numbers there are not comparable
with CI numbers.

## 🔜 Planned languages

Java (Temurin), C# (.NET), Kotlin/JVM, Zig, C, Ruby, PHP, TypeScript (Deno/Bun), Elixir, Haskell.
Adding one is described in [Contributing](09-contributing.md#add-a-language).
