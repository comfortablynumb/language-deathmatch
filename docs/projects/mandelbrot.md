# Mandelbrot

| Field | Value |
|-------|-------|
| Id | `mandelbrot` |
| Category | Simulation & Graphics (`simulation`) |
| Level | 3 — Medium |
| Kind | `cli` |
| Tags | `cpu-bound`, `floating-point`, `bit-packing`, `binary-output`, `stdout` |
| Languages | Go, Rust, C++, Assembly, Python, JavaScript |

## Goal

Render the Mandelbrot set as an **N × N** black-and-white bitmap in binary PBM format. The
[Computer Language Benchmarks Game](https://benchmarksgame-team.pages.debian.net/benchmarksgame/)
program, sequential, with the arithmetic order fixed so every language produces the same bits.
It measures scalar double-precision multiply/add throughput, tight branchy loops and bit packing.

## Specification

**Invocation:** `mandelbrot N`

**Input**

- Exactly one argument `N`, made only of ASCII digits `0-9` (no sign, no spaces, no
  underscores; leading zeros allowed), with `1 ≤ N ≤ 16000`. The image is N × N pixels.

**Output**

- A binary PBM (`P4`) image on stdout:
  1. the ASCII header `P4\n{N} {N}\n`;
  2. the rows from top (`y = 0`) to bottom (`y = N-1`), each `ceil(N/8)` bytes: one bit per pixel
     from left (`x = 0`) to right, **most significant bit first**, the last byte padded with zero
     bits. A bit is `1` when the pixel stays in the set.
- Exit code `0`.

Example: `mandelbrot 8` writes `P4\n8 8\n` followed by the 8 bytes
`02 00 0f 2f ff 2f 0f 00` (one per row); `mandelbrot 1` writes `P4\n1 1\n` and one `00` byte.

**Per pixel** — IEEE-754 double precision, every operation rounded on its own and evaluated
exactly in this order (identical bits in every language depend on it):

```
cr = 2.0*x/N - 1.5            # ((2.0 * x) / N) - 1.5
ci = 2.0*y/N - 1.0            # ((2.0 * y) / N) - 1.0
zr = zi = tr = ti = 0.0
repeat at most 50 times, while tr + ti <= 4.0:
    zi = 2.0*zr*zi + ci       # ((2.0 * zr) * zi) + ci
    zr = tr - ti + cr         # (tr - ti) + cr
    tr = zr*zr
    ti = zi*zi
in the set  ⇔  tr + ti <= 4.0 after the loop
```

**Errors**

- Missing argument, extra arguments, non-digit characters (including `+` and `-`), `N = 0` or
  `N > 16000`: print a usage message to **stderr**, nothing to stdout, exit code `1`.

**Rules**

- No fused multiply-add: compiled languages keep the default x86-64 baseline (no FMA
  instructions), C++ also builds with `-ffp-contract=off`, Go rounds each product with an
  explicit `float64(…)` conversion; never call `fma`/`mul_add`.
- No complex-number types (they change the operation order), no cardioid/bulb or periodicity
  shortcuts, no hand-written SIMD, no threads.
- Output must be buffered; Python and JavaScript write bytes (`bytearray`, `Buffer`), not text.

## Verification cases

| Name | Args | Exit | Expected stdout |
|------|------|------|-----------------|
| one pixel | `1` | 0 | sha256 `a8ed35a163cba662b15fe455af22d5f91668d6eb59ef9a2aa9e19e1658745819` |
| eight by eight | `8` | 0 | sha256 `5cb3c72ff26073f0dcd32ae46289dcf3ef468694ab383f4b98b1bf33c155f6d3` |
| leading zeros | `0008` | 0 | same as `8` |
| two hundred | `200` | 0 | sha256 `97610473750700638fc63d13cfa49d339b67c18e7f26b3f9c9acb61e746472d5` |
| one thousand | `1000` | 0 | sha256 `66b74292639771ac7a6d9307c2a1985b0be22b09f28159cc142f0af988532789` |
| zero | `0` | 1 | empty |
| missing argument | — | 1 | empty |
| too many arguments | `5 5` | 1 | empty |
| not a number | `abc` | 1 | empty |
| negative | `-5` | 1 | empty |
| plus sign | `+5` | 1 | empty |
| too large | `16001` | 1 | empty |

The output is binary, so every successful case is checked by `sha256`.

## Benchmark cases

| Id | Args | Warmup | Runs | Output | What it shows |
|----|------|--------|------|--------|---------------|
| `200` | `200` | 3 | 20 | 5.0 KB, sha256 `97610473…72d5` | Startup + ~1 M iterations of the inner loop |
| `1000` | `1000` | 1 | 10 | 125 KB, sha256 `66b74292…2789` | ~24 M iterations: double-precision multiply/add throughput |

## Implementation notes

| Language | Approach |
|----------|----------|
| Go | `float64` with `float64(…)` around each product (the Go spec may fuse `x*y + z` otherwise); reused row slice; `bufio.Writer` 64 KiB |
| Rust | `f64` (rustc never contracts into FMA); reused `Vec<u8>` row; `BufWriter` over locked stdout; explicit digit check (Rust's parser accepts `+`) |
| C++ | `double` with `-ffp-contract=off`; `std::from_chars` parsing; `std::ostream::write` with `sync_with_stdio(false)` |
| Assembly | x86-64 NASM, SSE2 scalar doubles, raw `write`/`exit` syscalls; `in_set` answers in the carry flag, `adc` packs it; 64 KiB buffer |
| Python | One `bytearray` per row written to `sys.stdout.buffer` |
| JavaScript | Whole rows packed into a fresh ~64 KiB `Buffer` per chunk; awaits `drain` on back-pressure |
