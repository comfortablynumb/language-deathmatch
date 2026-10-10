"""Mandelbrot: render the Mandelbrot set as an N×N binary PBM (P4) bitmap."""

import sys

MAX_SIZE = 16_000
MAX_ITERATIONS = 50
LIMIT = 4.0
USAGE = "usage: mandelbrot N  (N: 1..16000)"


def parse_size(args: list[str]) -> int | None:
    """Accept exactly one argument made only of ASCII digits, 1..MAX_SIZE."""
    if len(args) != 1:
        return None

    text = args[0]

    if not (text.isascii() and text.isdigit()):
        return None

    n = int(text)
    return n if 1 <= n <= MAX_SIZE else None


def in_set(cr: float, ci: float) -> bool:
    """Iterate z = z² + c up to MAX_ITERATIONS times; True if |z|² stayed ≤ 4."""
    zr = zi = tr = ti = 0.0

    for _ in range(MAX_ITERATIONS):
        if tr + ti > LIMIT:
            break

        zi = 2.0 * zr * zi + ci
        zr = tr - ti + cr
        tr = zr * zr
        ti = zi * zi

    return tr + ti <= LIMIT


def render_row(y: int, n: int) -> bytearray:
    """Pack the n pixels of row y, 8 per byte, most significant bit first."""
    row = bytearray((n + 7) // 8)
    ci = 2.0 * y / n - 1.0

    for x in range(n):
        if in_set(2.0 * x / n - 1.5, ci):
            row[x >> 3] |= 0x80 >> (x & 7)

    return row


def main() -> int:
    n = parse_size(sys.argv[1:])

    if n is None:
        print(USAGE, file=sys.stderr)
        return 1

    out = sys.stdout.buffer
    out.write(f"P4\n{n} {n}\n".encode("ascii"))

    for y in range(n):
        out.write(render_row(y, n))

    out.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
