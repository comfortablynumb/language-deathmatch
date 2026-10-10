// Primes sieve: count, sum and find the largest prime up to N with the Sieve of Eratosthenes.
package main

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strconv"
)

const maxLimit = 200_000_000

var errUsage = errors.New("usage: primes-sieve N  (N: 0..200000000)")

// summary is the result of scanning the sieve.
type summary struct {
	count   uint64
	sum     uint64
	largest uint64
}

func main() {
	n, err := parseLimit(os.Args[1:])

	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	out := bufio.NewWriter(os.Stdout)

	if err := writeSummary(out, summarize(sieve(n))); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// parseLimit accepts exactly one argument made only of ASCII digits.
func parseLimit(args []string) (int, error) {
	if len(args) != 1 || args[0] == "" {
		return 0, errUsage
	}

	for _, c := range []byte(args[0]) {
		if c < '0' || c > '9' {
			return 0, errUsage
		}
	}

	n, err := strconv.ParseUint(args[0], 10, 64)

	if err != nil || n > maxLimit {
		return 0, errUsage
	}

	return int(n), nil
}

// sieve returns one flag per integer 0..n; isPrime[i] is true when i is prime.
func sieve(n int) []bool {
	isPrime := make([]bool, n+1) // all false: 0 and 1 are not prime

	for i := 2; i <= n; i++ {
		isPrime[i] = true
	}

	for p := 2; p*p <= n; p++ {
		if !isPrime[p] {
			continue
		}

		for m := p * p; m <= n; m += p {
			isPrime[m] = false
		}
	}

	return isPrime
}

// summarize counts and sums the primes and finds the largest one (0 when there is none).
func summarize(isPrime []bool) summary {
	var s summary

	for i, prime := range isPrime {
		if prime {
			s.count++
			s.sum += uint64(i)
			s.largest = uint64(i)
		}
	}

	return s
}

// writeSummary writes the three result lines and flushes.
func writeSummary(out *bufio.Writer, s summary) error {
	fmt.Fprintf(out, "count: %d\nsum: %d\nlargest: %d\n", s.count, s.sum, s.largest)

	return out.Flush()
}
