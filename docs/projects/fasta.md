# Fasta

| Field | Value |
|-------|-------|
| Id | `fasta` |
| Category | Text & Data Processing (`text-processing`) |
| Level | 2 — Easy |
| Kind | `cli` |
| Tags | `strings`, `stdout`, `floating-point`, `io-bound` |
| Languages | Go, Rust, C++, C, Assembly, Zig, V, Java, Haskell, Python, JavaScript |

## Goal

Generate three DNA sequences in FASTA format: the Computer Language Benchmarks Game program,
sequential. One sequence cycles through a fixed string; two draw weighted random symbols from an
integer generator and a double-precision cumulative lookup. Everything is wrapped into 60-character
lines, so it measures string handling, a little floating point and buffered output throughput.

## Specification

**Invocation:** `fasta N`

**Input**

- Exactly one argument `N`, made only of ASCII digits `0-9` (no sign, no spaces, no
  underscores; leading zeros allowed), with `0 ≤ N ≤ 25000000`.

**Output**

Three FASTA records. Each sequence is wrapped at **60** characters per line; the last line may
be shorter, every line ends with `\n`, and there are never empty lines (a sequence of length 0
prints no lines at all, only its header).

1. `>ONE Homo sapiens alu` — the 287-character ALU string repeated cyclically, `2N` characters.
2. `>TWO IUB ambiguity codes` — `3N` random characters from the IUB table.
3. `>THREE Homo sapiens frequency` — `5N` random characters from the Homo sapiens table; the
   generator continues from the state record 2 left (one generator for the whole run).

Exit code `0`.

**ALU** (287 characters, the concatenation of):

```
GGCCGGGCGCGGTGGCTCACGCCTGTAATCCCAGCACTTTGG
GAGGCCGAGGCGGGCGGATCACCTGAGGTCAGGAGTTCGAGA
CCAGCCTGGCCAACATGGTGAAACCCCGTCTCTACTAAAAAT
ACAAAAATTAGCCGGGCGTGGTGGCGCGCGCCTGTAATCCCA
GCTACTCGGGAGGCTGAGGCAGGAGAATCGCTTGAACCCGGG
AGGCGGAGGTTGCAGTGAGCCGAGATCGCGCCACTGCACTCC
AGCCTGGGCGACAGAGCGAGACTCCGTCTCAAAAA
```

**Tables** (symbol, probability, in this order)

| Table | Entries |
|-------|---------|
| IUB | `a` 0.27, `c` 0.12, `g` 0.12, `t` 0.27, then `B D H K M N R S V W Y` at 0.02 each |
| Homo sapiens | `a` 0.3029549426680, `c` 0.1979883004921, `g` 0.1975473066391, `t` 0.3015094502008 |

**Random generator**

- Integer `seed` starts at `42`. For each random character:
  `seed = (seed × 3877 + 29573) mod 139968`, then `r = seed / 139968.0` (IEEE-754 double
  division). The intermediate value stays below 2^30, so 32-bit integers suffice.
- Cumulative probabilities: the running double sum of the table probabilities in table order
  (`c₀ = 0.0 + p₀`, `cᵢ = cᵢ₋₁ + pᵢ`).
- Pick the **first** entry whose cumulative probability is **greater than** `r` (`r < cᵢ`);
  if there is none, the last entry.

**Errors**

- Missing argument, extra arguments, non-digit characters or `N > 25000000`: print a usage
  message to **stderr**, nothing to stdout, exit code `1`.

**Rules**

- Exactly one generator step per random character; no tables precomputed per seed value.
- A linear scan or the standard library's binary search (e.g. Python `bisect.bisect_right`)
  over the cumulative table are both allowed.
- Single-threaded; output must be buffered.

Sanity anchor (the Benchmarks Game reference output): for `N = 1000`, the first line after
`>TWO IUB ambiguity codes` is `cttBtatcatatgctaKggNcataaaSatgtaaaDcDRtBggDtctttataattcBgtcg`.

## Verification cases

| Name | Args | Exit | Expected stdout |
|------|------|------|-----------------|
| zero | `0` | 0 | the three header lines only |
| one | `1` | 0 | headers with `GG`, `ctt`, `tgagc` |
| ten | `10` | 0 | exact (180 B): 20 ALU characters, 30 IUB and 50 Homo sapiens symbols |
| one thousand | `1000` | 0 | sha256 `62d1e8d0df7938d2aefda9a37887e0389231ea72c099c29a51afb6edca1bdc73` (ALU wraps; `3N` is a whole number of lines) |
| leading zeros | `0010` | 0 | same as `10` |
| missing argument | — | 1 | empty |
| too many arguments | `5 5` | 1 | empty |
| not a number | `abc` | 1 | empty |
| negative | `-5` | 1 | empty |
| plus sign | `+5` | 1 | empty |
| too large | `25000001` | 1 | empty |

## Benchmark cases

| Id | Args | Warmup | Runs | Output | What it shows |
|----|------|--------|------|--------|---------------|
| `1k` | `1000` | 3 | 20 | 10.2 KB, sha256 `62d1e8d0…dc73` | Process + runtime startup cost, 8,000 random symbols |
| `2500k` | `2500000` | 1 | 10 | 25.4 MB, sha256 `e3600e48…ab72` | 20 million generator steps, double divisions, cumulative lookups, buffered line output |

## Implementation notes

| Language | Approach |
|----------|----------|
| Go | `uint32` seed; linear scan over a `[]float64`; ALU lines sliced from `alu + alu[:60]`; `bufio.Writer` 64 KiB |
| Rust | `u32` seed; `Iterator::scan` cumulative table, `Iterator::position` lookup; `[u8; 61]` line into `BufWriter` over locked stdout |
| C++ | `std::uint32_t` seed; `std::ranges::find_if` lookup; `std::array<char, 61>` lines via `std::cout.write` with `sync_with_stdio(false)` |
| C | `uint32_t` seed; linear scan over a fixed `double` array; ALU lines with at most two `fwrite`s; `setvbuf` 64 KiB |
| Assembly | x86-64 NASM, raw `write`/`exit` syscalls; reciprocal-multiplication modulo, `cvtsi2sd`/`divsd`/`comisd`; cumulative table summed with `addsd`; 64 KiB buffer |
| Zig | `u32` seed; cumulative `f64` tables summed at comptime (same rounding as at run time); linear scan; ALU lines sliced from `alu ++ alu[0..60]` |
| V | `u32` seed; linear scan over a cumulative `[]f64`; ALU lines are slices of `alu + alu[..60]`; 64 KiB `strings.Builder` chunks |
| Java | `int` seed, `(double) seed / IM`; linear scan over a cumulative `double[]`; byte lines through a 64 KiB `BufferedOutputStream` |
| Haskell | `Int` seed threaded through a strict `IO` loop; cumulative `UArray Int Double` via `scanl1`; lines from `ByteString.unfoldrN` (one step per symbol) |
| Python | generator function as the LCG; `itertools.accumulate` + `bisect.bisect_right`; one list comprehension per line into `sys.stdout.buffer.writelines` |
| JavaScript | plain Numbers (exact below 2^53); `Float64Array` linear scan; `Uint8Array` lines copied into 64 KiB `Buffer` chunks; awaits `drain` on back-pressure |
