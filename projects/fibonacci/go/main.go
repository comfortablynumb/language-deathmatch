// Fibonacci: print the first N Fibonacci numbers (mod 2^64), one per line.
package main

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strconv"
)

const maxCount = 1_000_000_000

var errUsage = errors.New("usage: fibonacci N  (N: 0..1000000000)")

func main() {
	n, err := parseCount(os.Args[1:])

	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	out := bufio.NewWriterSize(os.Stdout, 64*1024)

	if err := writeFibonacci(out, n); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// parseCount accepts exactly one argument made only of ASCII digits.
func parseCount(args []string) (uint64, error) {
	if len(args) != 1 || args[0] == "" {
		return 0, errUsage
	}

	for _, c := range []byte(args[0]) {
		if c < '0' || c > '9' {
			return 0, errUsage
		}
	}

	n, err := strconv.ParseUint(args[0], 10, 64)

	if err != nil || n > maxCount {
		return 0, errUsage
	}

	return n, nil
}

// writeFibonacci writes F(0)..F(n-1); uint64 addition wraps modulo 2^64.
func writeFibonacci(out *bufio.Writer, n uint64) error {
	var a, b uint64 = 0, 1
	line := make([]byte, 0, 24)

	for i := uint64(0); i < n; i++ {
		line = strconv.AppendUint(line[:0], a, 10)
		line = append(line, '\n')

		if _, err := out.Write(line); err != nil {
			return err
		}

		a, b = b, a+b
	}

	return out.Flush()
}
