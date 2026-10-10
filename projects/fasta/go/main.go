// Fasta: generate three DNA sequences in FASTA format (Benchmarks Game, sequential).
package main

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strconv"
)

const (
	maxCount  = 25_000_000
	lineWidth = 60

	// Linear congruential generator: seed = (seed*ia + ic) % im.
	im   = 139968
	ia   = 3877
	ic   = 29573
	seed = 42
)

const alu = "GGCCGGGCGCGGTGGCTCACGCCTGTAATCCCAGCACTTTGG" +
	"GAGGCCGAGGCGGGCGGATCACCTGAGGTCAGGAGTTCGAGA" +
	"CCAGCCTGGCCAACATGGTGAAACCCCGTCTCTACTAAAAAT" +
	"ACAAAAATTAGCCGGGCGTGGTGGCGCGCGCCTGTAATCCCA" +
	"GCTACTCGGGAGGCTGAGGCAGGAGAATCGCTTGAACCCGGG" +
	"AGGCGGAGGTTGCAGTGAGCCGAGATCGCGCCACTGCACTCC" +
	"AGCCTGGGCGACAGAGCGAGACTCCGTCTCAAAAA"

var errUsage = errors.New("usage: fasta N  (N: 0..25000000)")

// acid is one symbol of a frequency table with its probability.
type acid struct {
	symbol      byte
	probability float64
}

var iub = []acid{
	{'a', 0.27}, {'c', 0.12}, {'g', 0.12}, {'t', 0.27},
	{'B', 0.02}, {'D', 0.02}, {'H', 0.02}, {'K', 0.02}, {'M', 0.02},
	{'N', 0.02}, {'R', 0.02}, {'S', 0.02}, {'V', 0.02}, {'W', 0.02}, {'Y', 0.02},
}

var homoSapiens = []acid{
	{'a', 0.3029549426680},
	{'c', 0.1979883004921},
	{'g', 0.1975473066391},
	{'t', 0.3015094502008},
}

// table holds the symbols and their cumulative probabilities, in table order.
type table struct {
	symbols    []byte
	cumulative []float64
}

func newTable(acids []acid) table {
	t := table{make([]byte, len(acids)), make([]float64, len(acids))}
	sum := 0.0

	for i, a := range acids {
		sum += a.probability
		t.symbols[i] = a.symbol
		t.cumulative[i] = sum
	}

	return t
}

// pick returns the first symbol whose cumulative probability exceeds r (else the last one).
func (t table) pick(r float64) byte {
	for i, c := range t.cumulative {
		if r < c {
			return t.symbols[i]
		}
	}

	return t.symbols[len(t.symbols)-1]
}

// random is the generator shared by records TWO and THREE.
type random struct {
	seed uint32
}

// next advances the generator and returns seed / im as a float64 in [0, 1).
func (g *random) next() float64 {
	g.seed = (g.seed*ia + ic) % im
	return float64(g.seed) / im
}

func main() {
	n, err := parseCount(os.Args[1:])

	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	out := bufio.NewWriterSize(os.Stdout, 64*1024)

	if err := writeFasta(out, n); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// parseCount accepts exactly one argument made only of ASCII digits.
func parseCount(args []string) (int, error) {
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

	return int(n), nil
}

// writeFasta writes the three records; one generator serves both random ones.
func writeFasta(out *bufio.Writer, n int) error {
	rng := &random{seed: seed}

	out.WriteString(">ONE Homo sapiens alu\n")
	writeRepeat(out, alu, 2*n)
	out.WriteString(">TWO IUB ambiguity codes\n")
	writeRandom(out, rng, newTable(iub), 3*n)
	out.WriteString(">THREE Homo sapiens frequency\n")
	writeRandom(out, rng, newTable(homoSapiens), 5*n)

	// bufio.Writer errors are sticky: Flush reports the first failed write.
	return out.Flush()
}

// writeRepeat writes n characters of s repeated cyclically, lineWidth per line.
func writeRepeat(out *bufio.Writer, s string, n int) {
	extended := s + s[:lineWidth] // a line starting anywhere in s never wraps
	pos := 0

	for left := n; left > 0; left -= lineWidth {
		count := min(lineWidth, left)
		out.WriteString(extended[pos : pos+count])
		out.WriteByte('\n')
		pos = (pos + count) % len(s)
	}
}

// writeRandom writes n symbols picked from t, one generator step each, lineWidth per line.
func writeRandom(out *bufio.Writer, rng *random, t table, n int) {
	var line [lineWidth + 1]byte

	for left := n; left > 0; left -= lineWidth {
		count := min(lineWidth, left)

		for i := range count {
			line[i] = t.pick(rng.next())
		}

		line[count] = '\n'
		out.Write(line[:count+1])
	}
}
