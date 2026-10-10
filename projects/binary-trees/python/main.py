"""Binary trees: allocate, walk and discard perfect binary trees (Benchmarks Game, sequential)."""

import sys

MIN_DEPTH = 4
MAX_INPUT = 21
USAGE = "usage: binary-trees N  (N: 0..21)"

# A node is a (left, right) tuple; a leaf is (None, None).
type Tree = tuple[Tree, Tree] | tuple[None, None]


def parse_depth(args: list[str]) -> int | None:
    """Accept exactly one argument made only of ASCII digits."""
    if len(args) != 1:
        return None

    text = args[0]

    if not (text.isascii() and text.isdigit()):
        return None

    n = int(text)
    return n if n <= MAX_INPUT else None


def bottom_up_tree(depth: int) -> Tree:
    """Allocate a perfect tree of the given depth, children before their parent.

    The tuple is built from variables (not the constant (None, None), which CPython
    would share), so every node, leaves included, is a fresh allocation.
    """
    left = right = None

    if depth > 0:
        left = bottom_up_tree(depth - 1)
        right = bottom_up_tree(depth - 1)

    return (left, right)


def check(tree: Tree) -> int:
    """Walk the whole tree and return its node count."""
    left, right = tree

    if left is None:
        return 1

    return 1 + check(left) + check(right)


def sum_checks(depth: int, iterations: int) -> int:
    """Build, check and drop `iterations` trees of `depth`, one at a time."""
    return sum(check(bottom_up_tree(depth)) for _ in range(iterations))


def run(n: int) -> list[str]:
    """Return the output lines: stretch tree, one per iteration depth, long-lived tree."""
    max_depth = max(MIN_DEPTH + 2, n)
    stretch_depth = max_depth + 1
    stretch = check(bottom_up_tree(stretch_depth))
    lines = [f"stretch tree of depth {stretch_depth}\t check: {stretch}\n"]

    long_lived = bottom_up_tree(max_depth)

    for depth in range(MIN_DEPTH, max_depth + 1, 2):
        iterations = 1 << (max_depth - depth + MIN_DEPTH)
        total = sum_checks(depth, iterations)
        lines.append(f"{iterations}\t trees of depth {depth}\t check: {total}\n")

    lines.append(f"long lived tree of depth {max_depth}\t check: {check(long_lived)}\n")
    return lines


def main() -> int:
    n = parse_depth(sys.argv[1:])

    if n is None:
        print(USAGE, file=sys.stderr)
        return 1

    sys.stdout.writelines(run(n))
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
