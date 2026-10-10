# Fibonacci

| Field | Value |
|-------|-------|
| Id | `fibonacci` |
| Category | Algorithms & Math (`algorithms`) |
| Level | 1 — Trivial |
| Kind | `cli` |
| Tags | `cpu-bound`, `integer-arithmetic`, `loops`, `stdout`, `startup` |
| Languages | Go, Rust, C++, Assembly, Python, JavaScript |

## Goal

Print the first **N** Fibonacci numbers, one per line. Small N measures runtime startup;
large N measures integer arithmetic, number formatting and buffered output throughput.

## Specification

**Invocation:** `fibonacci N`

**Input**

- Exactly one argument `N`, made only of ASCII digits `0-9` (no sign, no spaces, no
  underscores; leading zeros allowed), with `0 ≤ N ≤ 1000000000`.

**Output**

- `F(0), F(1), …, F(N-1)` written to stdout in decimal, each followed by `\n`
  (so `N = 0` prints nothing).
- `F(0) = 0`, `F(1) = 1`, `F(i) = F(i-1) + F(i-2)` computed with **unsigned 64-bit wrapping
  arithmetic** (modulo 2^64). Values are exact up to `F(93) = 12200160415121876738`; from
  `F(94)` they wrap (`F(94) mod 2^64 = 1293530146158671551`). Wrapping keeps the output
  well defined for any N and identical across languages.
- Exit code `0`.

**Errors**

- Missing argument, extra arguments, non-digit characters or `N > 1000000000`: print a usage
  message to **stderr**, nothing to stdout, exit code `1`.

**Rules**

- Iterative algorithm (two running values); no closed form, no recursion, no lookup tables.
- Output must be buffered (one write per number is allowed only if the runtime buffers it).

## Verification cases

| Name | Args | Exit | Expected stdout |
|------|------|------|-----------------|
| first ten | `10` | 0 | `0 1 1 2 3 5 8 13 21 34` (one per line) |
| zero | `0` | 0 | empty |
| leading zeros | `007` | 0 | `0 1 1 2 3 5 8` (one per line) |
| largest exact | `94` | 0 | sha256 `e6a770316d41a6a4d4e48b1df7baba40b896cdf915faee02ebd04c92389d4cdf` |
| wraps at 2^64 | `100` | 0 | sha256 `521c26b462dfd13a62b2c6047edc543427ff6e911f3235b5735c27d2c9ff0185` |
| one thousand | `1000` | 0 | sha256 `fedc4a9ecd4bdd016f813fd78b0e5939df4245d04e742150360a13a4d4d5d8a5` |
| missing argument | — | 1 | empty |
| too many arguments | `5 5` | 1 | empty |
| not a number | `abc` | 1 | empty |
| negative | `-5` | 1 | empty |
| plus sign | `+5` | 1 | empty |
| too large | `1000000001` | 1 | empty |

## Benchmark cases

| Id | Args | Warmup | Runs | Output | What it shows |
|----|------|--------|------|--------|---------------|
| `startup` | `10` | 3 | 30 | 23 B, sha256 `356f8e53…2ad5` | Process + runtime startup cost |
| `throughput` | `2000000` | 1 | 10 | 40.8 MB, sha256 `578b2670…2abb` | Arithmetic, integer→text formatting, buffered I/O |

## Implementation notes

| Language | Approach |
|----------|----------|
| Go | `uint64` wraps natively; `strconv.AppendUint` into a reused buffer; `bufio.Writer` 64 KiB |
| Rust | `u64::wrapping_add`; `writeln!` into `BufWriter` over locked stdout; explicit digit check (Rust's parser accepts `+`) |
| C++ | `std::uint64_t` wraps; `std::from_chars` parsing; `std::cout` with `sync_with_stdio(false)` |
| Assembly | x86-64 NASM, raw `write`/`exit` syscalls, reciprocal-multiplication division by 10, 64 KiB buffer |
| Python | `(a + b) & MASK`; generator + `sys.stdout.writelines` |
| JavaScript | `BigInt.asUintN(64, a + b)`; 64 KiB string chunks; awaits `drain` on back-pressure |
