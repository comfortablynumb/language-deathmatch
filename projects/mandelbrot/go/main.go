// Mandelbrot: render the Mandelbrot set as an N×N binary PBM (P4) bitmap.
package main

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strconv"
)

const (
	maxSize       = 16_000
	maxIterations = 50
	limit         = 4.0
)

var errUsage = errors.New("usage: mandelbrot N  (N: 1..16000)")

func main() {
	n, err := parseSize(os.Args[1:])

	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	out := bufio.NewWriterSize(os.Stdout, 64*1024)

	if err := writeImage(out, n); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// parseSize accepts exactly one argument made only of ASCII digits, 1..maxSize.
func parseSize(args []string) (int, error) {
	if len(args) != 1 || args[0] == "" {
		return 0, errUsage
	}

	for _, c := range []byte(args[0]) {
		if c < '0' || c > '9' {
			return 0, errUsage
		}
	}

	n, err := strconv.Atoi(args[0])

	if err != nil || n < 1 || n > maxSize {
		return 0, errUsage
	}

	return n, nil
}

// writeImage writes the PBM header, then the n rows of the bitmap from top to bottom.
func writeImage(out *bufio.Writer, n int) error {
	if _, err := fmt.Fprintf(out, "P4\n%d %d\n", n, n); err != nil {
		return err
	}

	row := make([]byte, (n+7)/8)

	for y := range n {
		renderRow(row, y, n)

		if _, err := out.Write(row); err != nil {
			return err
		}
	}

	return out.Flush()
}

// renderRow packs the n pixels of row y into row, 8 per byte, most significant bit first.
func renderRow(row []byte, y, n int) {
	size := float64(n)
	ci := 2.0*float64(y)/size - 1.0
	clear(row)

	for x := range n {
		cr := 2.0*float64(x)/size - 1.5

		if inSet(cr, ci) {
			row[x/8] |= 0x80 >> (x % 8)
		}
	}
}

// inSet iterates z = z² + c up to maxIterations times and reports whether |z|² stayed ≤ 4.
// The float64(…) conversions round each product on its own: the Go spec otherwise lets the
// compiler fuse x*y + z into one FMA (amd64 v1 has no FMA, but arm64 does).
func inSet(cr, ci float64) bool {
	var zr, zi, tr, ti float64

	for i := 0; i < maxIterations && tr+ti <= limit; i++ {
		zi = float64(2.0*zr*zi) + ci
		zr = tr - ti + cr
		tr = float64(zr * zr)
		ti = float64(zi * zi)
	}

	return tr+ti <= limit
}
