"""Fasta: generate three DNA sequences in FASTA format (Benchmarks Game, sequential)."""

import sys
from bisect import bisect_right
from collections.abc import Iterator
from itertools import accumulate, islice
from typing import NamedTuple

MAX_COUNT = 25_000_000
LINE_WIDTH = 60
USAGE = "usage: fasta N  (N: 0..25000000)"

# Linear congruential generator: seed = (seed * IA + IC) % IM.
IM = 139968
IA = 3877
IC = 29573
SEED = 42

ALU = (
    b"GGCCGGGCGCGGTGGCTCACGCCTGTAATCCCAGCACTTTGG"
    b"GAGGCCGAGGCGGGCGGATCACCTGAGGTCAGGAGTTCGAGA"
    b"CCAGCCTGGCCAACATGGTGAAACCCCGTCTCTACTAAAAAT"
    b"ACAAAAATTAGCCGGGCGTGGTGGCGCGCGCCTGTAATCCCA"
    b"GCTACTCGGGAGGCTGAGGCAGGAGAATCGCTTGAACCCGGG"
    b"AGGCGGAGGTTGCAGTGAGCCGAGATCGCGCCACTGCACTCC"
    b"AGCCTGGGCGACAGAGCGAGACTCCGTCTCAAAAA"
)

IUB = [
    ("a", 0.27), ("c", 0.12), ("g", 0.12), ("t", 0.27),
    ("B", 0.02), ("D", 0.02), ("H", 0.02), ("K", 0.02), ("M", 0.02),
    ("N", 0.02), ("R", 0.02), ("S", 0.02), ("V", 0.02), ("W", 0.02), ("Y", 0.02),
]

HOMO_SAPIENS = [
    ("a", 0.3029549426680),
    ("c", 0.1979883004921),
    ("g", 0.1975473066391),
    ("t", 0.3015094502008),
]


class Table(NamedTuple):
    """Symbols by index plus the cumulative probabilities, in table order."""

    lookup: bytes
    cumulative: list[float]


def make_table(entries: list[tuple[str, float]]) -> Table:
    """Running sums of the probabilities; the last symbol is repeated at index len(entries)."""
    symbols = "".join(symbol for symbol, _ in entries).encode("ascii")
    cumulative = list(accumulate(probability for _, probability in entries))
    # bisect_right returns len(cumulative) when no entry exceeds r: that maps to the last symbol.
    return Table(symbols + symbols[-1:], cumulative)


def random_numbers(seed: int = SEED) -> Iterator[float]:
    """Advance the generator forever, yielding seed / IM in [0, 1)."""
    while True:
        seed = (seed * IA + IC) % IM
        yield seed / IM


def parse_count(args: list[str]) -> int | None:
    """Accept exactly one argument made only of ASCII digits."""
    if len(args) != 1:
        return None

    text = args[0]

    if not (text.isascii() and text.isdigit()):
        return None

    n = int(text)
    return n if n <= MAX_COUNT else None


def repeat_lines(s: bytes, n: int) -> Iterator[bytes]:
    """Yield n characters of s repeated cyclically, LINE_WIDTH per line."""
    extended = s + s[:LINE_WIDTH]  # a line starting anywhere in s never wraps
    pos = 0

    for start in range(0, n, LINE_WIDTH):
        count = min(LINE_WIDTH, n - start)
        yield extended[pos : pos + count] + b"\n"
        pos = (pos + count) % len(s)


def random_lines(table: Table, randoms: Iterator[float], n: int) -> Iterator[bytes]:
    """Yield n symbols picked from table, one generator step each, LINE_WIDTH per line."""
    lookup, cumulative = table

    for start in range(0, n, LINE_WIDTH):
        count = min(LINE_WIDTH, n - start)
        line = [lookup[bisect_right(cumulative, r)] for r in islice(randoms, count)]
        line.append(ord("\n"))
        yield bytes(line)


def fasta(n: int) -> Iterator[bytes]:
    """Yield the three records; one generator serves both random ones."""
    randoms = random_numbers()

    yield b">ONE Homo sapiens alu\n"
    yield from repeat_lines(ALU, 2 * n)
    yield b">TWO IUB ambiguity codes\n"
    yield from random_lines(make_table(IUB), randoms, 3 * n)
    yield b">THREE Homo sapiens frequency\n"
    yield from random_lines(make_table(HOMO_SAPIENS), randoms, 5 * n)


def main() -> int:
    n = parse_count(sys.argv[1:])

    if n is None:
        print(USAGE, file=sys.stderr)
        return 1

    out = sys.stdout.buffer
    out.writelines(fasta(n))
    out.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
