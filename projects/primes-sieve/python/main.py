"""Primes sieve: count, sum and find the largest prime up to N with the Sieve of Eratosthenes."""

import sys
from itertools import compress
from math import isqrt
from typing import NamedTuple

MAX_LIMIT = 200_000_000
USAGE = "usage: primes-sieve N  (N: 0..200000000)"


class Summary(NamedTuple):
    """The result of scanning the sieve."""

    count: int
    total: int
    largest: int


def parse_limit(args: list[str]) -> int | None:
    """Accept exactly one argument made only of ASCII digits."""
    if len(args) != 1:
        return None

    text = args[0]

    if not (text.isascii() and text.isdigit()):
        return None

    n = int(text)
    return n if n <= MAX_LIMIT else None


def sieve(n: int) -> bytearray:
    """Return one byte per integer 0..n: 1 when the integer is prime."""
    is_prime = bytearray(b"\x01") * (n + 1)
    is_prime[:2] = bytes(min(2, n + 1))  # 0 and 1 are not prime

    for p in range(2, isqrt(n) + 1):
        if is_prime[p]:
            # Slice assignment crosses off p*p, p*p + p, ... in one C-level loop.
            is_prime[p * p :: p] = bytes(len(range(p * p, n + 1, p)))

    return is_prime


def summarize(is_prime: bytearray) -> Summary:
    """Count and sum the primes and find the largest one (0 when there is none)."""
    count = total = largest = 0

    for prime in compress(range(len(is_prime)), is_prime):
        count += 1
        total += prime
        largest = prime

    return Summary(count, total, largest)


def main() -> int:
    n = parse_limit(sys.argv[1:])

    if n is None:
        print(USAGE, file=sys.stderr)
        return 1

    count, total, largest = summarize(sieve(n))
    sys.stdout.write(f"count: {count}\nsum: {total}\nlargest: {largest}\n")
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
