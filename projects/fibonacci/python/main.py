"""Fibonacci: print the first N Fibonacci numbers (mod 2^64), one per line."""

import sys
from collections.abc import Iterator

MAX_COUNT = 1_000_000_000
MASK = (1 << 64) - 1
USAGE = "usage: fibonacci N  (N: 0..1000000000)"


def parse_count(args: list[str]) -> int | None:
    """Accept exactly one argument made only of ASCII digits."""
    if len(args) != 1:
        return None

    text = args[0]

    if not (text.isascii() and text.isdigit()):
        return None

    n = int(text)
    return n if n <= MAX_COUNT else None


def fibonacci(n: int) -> Iterator[int]:
    """Yield F(0)..F(n-1); Python ints are unbounded, so wrap with a 64-bit mask."""
    a, b = 0, 1

    for _ in range(n):
        yield a
        a, b = b, (a + b) & MASK


def main() -> int:
    n = parse_count(sys.argv[1:])

    if n is None:
        print(USAGE, file=sys.stderr)
        return 1

    sys.stdout.writelines(f"{value}\n" for value in fibonacci(n))
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
