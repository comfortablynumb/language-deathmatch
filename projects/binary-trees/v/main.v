// Binary trees: allocate, walk and discard perfect binary trees (Benchmarks Game, sequential).
module main

import math
import os
import strconv
import strings

const min_depth = 4
const max_input = u64(21)
const usage = 'usage: binary-trees N  (N: 0..21)'

// Node is one heap-allocated tree node; a leaf has nil children.
struct Node {
	left  &Node = unsafe { nil }
	right &Node = unsafe { nil }
}

fn main() {
	n := parse_depth(os.args[1..]) or {
		eprintln(usage)
		exit(1)
	}

	run(n) or {
		eprintln('binary-trees: ${err}')
		exit(1)
	}
}

// parse_depth accepts exactly one argument made only of ASCII digits.
fn parse_depth(args []string) ?int {
	if args.len != 1 || args[0] == '' {
		return none
	}

	for c in args[0] {
		if !c.is_digit() {
			return none
		}
	}

	n := strconv.parse_uint(args[0], 10, 64) or { return none }

	if n > max_input {
		return none
	}

	return int(n)
}

// bottom_up_tree allocates a perfect tree of the given depth, one &Node{} per node.
fn bottom_up_tree(depth int) &Node {
	if depth == 0 {
		return &Node{}
	}

	return &Node{
		left:  bottom_up_tree(depth - 1)
		right: bottom_up_tree(depth - 1)
	}
}

// check walks the whole tree and returns its node count.
fn (n &Node) check() int {
	if isnil(n.left) {
		return 1
	}

	return 1 + n.left.check() + n.right.check()
}

// run prints the stretch tree, one line per iteration depth and the long-lived tree.
fn run(n int) ! {
	max_depth := math.max(min_depth + 2, n)
	stretch_depth := max_depth + 1
	mut out := strings.new_builder(1024)

	stretch := bottom_up_tree(stretch_depth).check()
	out.write_string('stretch tree of depth ${stretch_depth}\t check: ${stretch}\n')

	long_lived := bottom_up_tree(max_depth)

	for depth := min_depth; depth <= max_depth; depth += 2 {
		iterations := 1 << (max_depth - depth + min_depth)
		sum := sum_checks(depth, iterations)
		out.write_string('${iterations}\t trees of depth ${depth}\t check: ${sum}\n')
	}

	out.write_string('long lived tree of depth ${max_depth}\t check: ${long_lived.check()}\n')

	mut stdout := os.stdout()
	stdout.write(out)!
}

// sum_checks builds, checks and drops `iterations` trees of `depth`, one at a time.
fn sum_checks(depth int, iterations int) int {
	mut sum := 0

	for _ in 0 .. iterations {
		sum += bottom_up_tree(depth).check()
	}

	return sum
}
