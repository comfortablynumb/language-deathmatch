# Primes Sieve

| Field | Value |
|-------|-------|
| Id | `primes-sieve` |
| Category | Algorithms & Math (`algorithms`) |
| Level | 2 — Easy |
| Kind | `cli` |
| Tags | `cpu-bound`, `memory`, `loops`, `integer-arithmetic` |
| Languages | Go, Rust, C++, Assembly, Python, JavaScript |

## Goal

Count the primes up to **N**, add them up and report the largest one, using the Sieve of
Eratosthenes over one byte per integer. Crossing off multiples is a stream of strided writes over a
large array and the final scan reads it sequentially: small N measures startup and loop overhead,
large N measures tight loops, bounds checks and memory bandwidth.

## Specification

**Invocation:** `primes-sieve N`

**Input**

- Exactly one argument `N`, made only of ASCII digits `0-9` (no sign, no spaces, no
  underscores; leading zeros allowed), with `0 ≤ N ≤ 200000000`.

**Output**

- Exactly three lines on stdout:

  ```
  count: C
  sum: S
  largest: P
  ```

  where `C` is the number of primes `≤ N`, `S` their sum and `P` the largest prime `≤ N`
  (`0` when there is none, i.e. for `N < 2`). All values in decimal, each line followed by `\n`.
- `S` is computed as an unsigned 64-bit integer; for `N = 200000000` it is
  `1075207199997334`, far below 2^64 (and below 2^53, so it is exact even as a double).
- Exit code `0`.

**Errors**

- Missing argument, extra arguments, non-digit characters or `N > 200000000`: print a usage
  message to **stderr**, nothing to stdout, exit code `1`.

**Rules**

- One byte (or `bool`) flag per integer `0..N` (`N + 1` flags): no bit packing, no odd-only
  layout, no wheel, no segmentation. (C++ must therefore avoid `std::vector<bool>`.)
- For `p = 2, 3, …` while `p × p ≤ N`: if `p` is still marked prime, cross off
  `p×p, p×p+p, …, ≤ N`. Then scan the flags to count, sum and find the largest prime.
- Index arithmetic must not overflow (`p × p` and `multiple + p` stay below 2^31 for the allowed
  range; 64-bit indices are used where the language has them).
- Python may cross off with slice assignment (`is_prime[p*p::p] = bytes(k)`) and scan with
  `itertools.compress` — the idiomatic built-ins for the same algorithm.
- Assembly allocates the flag array with the `mmap` syscall (no libc).
- Output must be buffered.

## Verification cases

| Name | Args | Exit | Expected stdout |
|------|------|------|-----------------|
| zero | `0` | 0 | `count: 0` `sum: 0` `largest: 0` (one per line) |
| one | `1` | 0 | `count: 0` `sum: 0` `largest: 0` |
| two | `2` | 0 | `count: 1` `sum: 2` `largest: 2` |
| ten | `10` | 0 | `count: 4` `sum: 17` `largest: 7` |
| one hundred | `100` | 0 | `count: 25` `sum: 1060` `largest: 97` |
| one million | `1000000` | 0 | `count: 78498` `sum: 37550402023` `largest: 999983` |
| leading zeros | `0010` | 0 | `count: 4` `sum: 17` `largest: 7` |
| missing argument | — | 1 | empty |
| too many arguments | `5 5` | 1 | empty |
| not a number | `abc` | 1 | empty |
| negative | `-5` | 1 | empty |
| plus sign | `+5` | 1 | empty |
| too large | `200000001` | 1 | empty |

## Benchmark cases

| Id | Args | Warmup | Runs | Output | What it shows |
|----|------|--------|------|--------|---------------|
| `1m` | `1000000` | 3 | 20 | 46 B, sha256 `cf60ec8d…cb0e` | 1 MB flag array in cache: startup and loop overhead |
| `100m` | `100000000` | 1 | 10 | 54 B, sha256 `54f79bcb…c6fc` | 100 MB flag array: strided writes and scan bound by memory bandwidth |

For `N = 100000000` the output is `count: 5761455`, `sum: 279209790387276`,
`largest: 99999989`.

## Implementation notes

| Language | Approach |
|----------|----------|
| Go | `[]bool` (one byte each), zero-filled by `make`, 2..N set to `true`; `int` indices; `bufio.Writer` |
| Rust | `vec![true; n + 1]` (`Vec<bool>` is one byte per flag); `(p*p..=n).step_by(p)`; `usize::isqrt`; `BufWriter` over locked stdout |
| C++ | `std::vector<std::uint8_t>` (not the bit-packed `std::vector<bool>`); `std::size_t` indices; `std::from_chars` parsing |
| Assembly | x86-64 NASM, `mmap` for the zeroed flag array, `rep stosb` to mark 2..N, byte loops, raw `write`/`exit` |
| Python | `bytearray`; slice assignment crosses off multiples in C; `itertools.compress` yields the primes for the scan |
| JavaScript | `Uint8Array` filled with 1; small-integer indices; the sum fits in a `Number` exactly (< 2^53) |
