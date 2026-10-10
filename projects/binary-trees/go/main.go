// Binary trees: allocate, walk and discard perfect binary trees (Benchmarks Game, sequential).
package main

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strconv"
)

const (
	minDepth = 4
	maxInput = 21
)

var errUsage = errors.New("usage: binary-trees N  (N: 0..21)")

// Node is one heap-allocated tree node; a leaf has nil children.
type Node struct {
	left, right *Node
}

func main() {
	n, err := parseDepth(os.Args[1:])

	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	out := bufio.NewWriterSize(os.Stdout, 64*1024)

	if err := run(out, n); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// parseDepth accepts exactly one argument made only of ASCII digits.
func parseDepth(args []string) (int, error) {
	if len(args) != 1 || args[0] == "" {
		return 0, errUsage
	}

	for _, c := range []byte(args[0]) {
		if c < '0' || c > '9' {
			return 0, errUsage
		}
	}

	n, err := strconv.ParseUint(args[0], 10, 64)

	if err != nil || n > maxInput {
		return 0, errUsage
	}

	return int(n), nil
}

// bottomUpTree allocates a perfect tree of the given depth, children before their parent.
func bottomUpTree(depth int) *Node {
	if depth == 0 {
		return &Node{}
	}

	return &Node{left: bottomUpTree(depth - 1), right: bottomUpTree(depth - 1)}
}

// check walks the whole tree and returns its node count.
func (n *Node) check() int {
	if n.left == nil {
		return 1
	}

	return 1 + n.left.check() + n.right.check()
}

// run prints the stretch tree, one line per iteration depth and the long-lived tree.
func run(out *bufio.Writer, n int) error {
	maxDepth := max(minDepth+2, n)
	stretchDepth := maxDepth + 1

	stretch := bottomUpTree(stretchDepth).check()
	fmt.Fprintf(out, "stretch tree of depth %d\t check: %d\n", stretchDepth, stretch)

	longLived := bottomUpTree(maxDepth)

	for depth := minDepth; depth <= maxDepth; depth += 2 {
		iterations := 1 << (maxDepth - depth + minDepth)
		sum := sumChecks(depth, iterations)
		fmt.Fprintf(out, "%d\t trees of depth %d\t check: %d\n", iterations, depth, sum)
	}

	fmt.Fprintf(out, "long lived tree of depth %d\t check: %d\n", maxDepth, longLived.check())
	return out.Flush()
}

// sumChecks builds, checks and drops `iterations` trees of `depth`, one at a time.
func sumChecks(depth, iterations int) int {
	sum := 0

	for range iterations {
		sum += bottomUpTree(depth).check()
	}

	return sum
}
