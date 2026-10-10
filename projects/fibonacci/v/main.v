// Fibonacci: print the first N Fibonacci numbers (mod 2^64), one per line.
module main

import os
import strconv
import strings

const max_count = u64(1_000_000_000)
const buffer_size = 64 * 1024
const usage = 'usage: fibonacci N  (N: 0..1000000000)'

fn main() {
	n := parse_count(os.args[1..]) or {
		eprintln(usage)
		exit(1)
	}

	write_fibonacci(n) or {
		eprintln('fibonacci: ${err}')
		exit(1)
	}
}

// parse_count accepts exactly one argument made only of ASCII digits.
fn parse_count(args []string) ?u64 {
	if args.len != 1 || args[0] == '' {
		return none
	}

	for c in args[0] {
		if !c.is_digit() {
			return none
		}
	}

	n := strconv.parse_uint(args[0], 10, 64) or { return none }

	if n > max_count {
		return none
	}

	return n
}

// write_fibonacci writes F(0)..F(n-1); u64 addition wraps modulo 2^64.
fn write_fibonacci(n u64) ! {
	mut out := strings.new_builder(buffer_size + 32)
	mut a, mut b := u64(0), u64(1)

	for _ in 0 .. n {
		out.write_u_decimal(a)
		out.write_u8(`\n`)

		if out.len >= buffer_size {
			flush(mut out)!
		}

		a, b = b, a + b
	}

	flush(mut out)!
}

// flush writes the buffered bytes to stdout in one call and empties the buffer.
fn flush(mut out strings.Builder) ! {
	mut stdout := os.stdout()
	stdout.write(out)!
	out.clear()
}
