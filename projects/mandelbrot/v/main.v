// Mandelbrot: render the Mandelbrot set as an N×N binary PBM (P4) bitmap.
module main

import os
import strconv
import strings

const max_size = u64(16_000)
const max_iterations = 50
const limit = 4.0
const buffer_size = 64 * 1024
const usage = 'usage: mandelbrot N  (N: 1..16000)'

fn main() {
	n := parse_size(os.args[1..]) or {
		eprintln(usage)
		exit(1)
	}

	write_image(n) or {
		eprintln('mandelbrot: ${err}')
		exit(1)
	}
}

// parse_size accepts exactly one argument made only of ASCII digits, 1..max_size.
fn parse_size(args []string) ?int {
	if args.len != 1 || args[0] == '' {
		return none
	}

	for c in args[0] {
		if !c.is_digit() {
			return none
		}
	}

	n := strconv.parse_uint(args[0], 10, 64) or { return none }

	if n < 1 || n > max_size {
		return none
	}

	return int(n)
}

// write_image writes the PBM header, then the n rows of the bitmap from top to bottom.
fn write_image(n int) ! {
	mut row := []u8{len: (n + 7) / 8}
	mut out := strings.new_builder(buffer_size + row.len)

	out.write_string('P4\n${n} ${n}\n')

	for y in 0 .. n {
		render_row(mut row, y, n)
		out << row

		if out.len >= buffer_size {
			flush(mut out)!
		}
	}

	flush(mut out)!
}

// render_row packs the n pixels of row y into row, 8 per byte, most significant bit first.
fn render_row(mut row []u8, y int, n int) {
	size := f64(n)
	ci := 2.0 * f64(y) / size - 1.0

	for mut b in row {
		b = 0
	}

	for x in 0 .. n {
		cr := 2.0 * f64(x) / size - 1.5

		if in_set(cr, ci) {
			row[x / 8] |= u8(0x80) >> (x % 8)
		}
	}
}

// in_set iterates z = z² + c up to max_iterations times and reports whether |z|² stayed <= 4.
// V emits these expressions to C as written; -ffp-contract=off keeps the C compiler from
// fusing a product and a sum into one FMA, so every operation is rounded on its own.
fn in_set(cr f64, ci f64) bool {
	mut zr, mut zi, mut tr, mut ti := 0.0, 0.0, 0.0, 0.0
	mut i := 0

	for i < max_iterations && tr + ti <= limit {
		zi = 2.0 * zr * zi + ci
		zr = tr - ti + cr
		tr = zr * zr
		ti = zi * zi
		i++
	}

	return tr + ti <= limit
}

// flush writes the buffered bytes to stdout in one call and empties the buffer.
fn flush(mut out strings.Builder) ! {
	mut stdout := os.stdout()
	stdout.write(out)!
	out.clear()
}
