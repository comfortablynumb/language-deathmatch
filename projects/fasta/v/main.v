// Fasta: generate three DNA sequences in FASTA format (Benchmarks Game, sequential).
module main

import math
import os
import strconv
import strings

const max_count = u64(25_000_000)
const line_width = 60
const buffer_size = 64 * 1024
const usage = 'usage: fasta N  (N: 0..25000000)'

// Linear congruential generator: seed = (seed * ia + ic) % im.
const im = u32(139968)
const ia = u32(3877)
const ic = u32(29573)
const initial_seed = u32(42)

const alu = 'GGCCGGGCGCGGTGGCTCACGCCTGTAATCCCAGCACTTTGG' +
	'GAGGCCGAGGCGGGCGGATCACCTGAGGTCAGGAGTTCGAGA' + 'CCAGCCTGGCCAACATGGTGAAACCCCGTCTCTACTAAAAAT' +
	'ACAAAAATTAGCCGGGCGTGGTGGCGCGCGCCTGTAATCCCA' + 'GCTACTCGGGAGGCTGAGGCAGGAGAATCGCTTGAACCCGGG' +
	'AGGCGGAGGTTGCAGTGAGCCGAGATCGCGCCACTGCACTCC' + 'AGCCTGGGCGACAGAGCGAGACTCCGTCTCAAAAA'

// Frequency tables: symbols and their probabilities, in table order.
const iub_symbols = 'acgtBDHKMNRSVWY'
const iub_probabilities = [0.27, 0.12, 0.12, 0.27, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02,
	0.02, 0.02, 0.02]!
const homo_sapiens_symbols = 'acgt'
const homo_sapiens_probabilities = [0.3029549426680, 0.1979883004921, 0.1975473066391,
	0.3015094502008]!

// Table holds the symbols and their cumulative probabilities, in table order.
struct Table {
	symbols    []u8
	cumulative []f64
}

// new_table sums the probabilities in table order, starting from 0.0.
fn new_table(symbols string, probabilities []f64) Table {
	mut cumulative := []f64{cap: probabilities.len}
	mut sum := 0.0

	for p in probabilities {
		sum += p
		cumulative << sum
	}

	return Table{
		symbols:    symbols.bytes()
		cumulative: cumulative
	}
}

// pick returns the first symbol whose cumulative probability exceeds r (else the last one).
fn (t &Table) pick(r f64) u8 {
	for i, c in t.cumulative {
		if r < c {
			return t.symbols[i]
		}
	}

	return t.symbols.last()
}

// Random is the generator shared by records TWO and THREE.
struct Random {
mut:
	seed u32
}

// next advances the generator and returns seed / im as an f64 in [0, 1).
fn (mut g Random) next() f64 {
	g.seed = (g.seed * ia + ic) % im
	return f64(g.seed) / f64(im)
}

fn main() {
	n := parse_count(os.args[1..]) or {
		eprintln(usage)
		exit(1)
	}

	write_fasta(n) or {
		eprintln('fasta: ${err}')
		exit(1)
	}
}

// parse_count accepts exactly one argument made only of ASCII digits.
fn parse_count(args []string) ?int {
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

	return int(n)
}

// write_fasta writes the three records; one generator serves both random ones.
fn write_fasta(n int) ! {
	mut out := strings.new_builder(buffer_size + line_width + 1)
	mut rng := Random{
		seed: initial_seed
	}

	out.write_string('>ONE Homo sapiens alu\n')
	write_repeat(mut out, alu, 2 * n)!
	out.write_string('>TWO IUB ambiguity codes\n')
	write_random(mut out, mut rng, new_table(iub_symbols, iub_probabilities[..]), 3 * n)!
	out.write_string('>THREE Homo sapiens frequency\n')
	homo_sapiens := new_table(homo_sapiens_symbols, homo_sapiens_probabilities[..])
	write_random(mut out, mut rng, homo_sapiens, 5 * n)!
	flush(mut out)!
}

// write_repeat writes n characters of s repeated cyclically, line_width per line.
fn write_repeat(mut out strings.Builder, s string, n int) ! {
	extended := (s + s[..line_width]).bytes() // a line starting anywhere in s never wraps
	mut pos := 0

	for left := n; left > 0; left -= line_width {
		count := math.min(line_width, left)
		out << extended[pos..pos + count]
		out.write_u8(`\n`)
		pos = (pos + count) % s.len
		flush_if_full(mut out)!
	}
}

// write_random writes n symbols picked from t, one generator step each, line_width per line.
fn write_random(mut out strings.Builder, mut rng Random, t &Table, n int) ! {
	mut line := []u8{len: line_width + 1}

	for left := n; left > 0; left -= line_width {
		count := math.min(line_width, left)

		for i in 0 .. count {
			line[i] = t.pick(rng.next())
		}

		line[count] = `\n`
		out << line[..count + 1]
		flush_if_full(mut out)!
	}
}

// flush_if_full writes the buffer to stdout once it holds at least buffer_size bytes.
fn flush_if_full(mut out strings.Builder) ! {
	if out.len >= buffer_size {
		flush(mut out)!
	}
}

// flush writes the buffered bytes to stdout in one call and empties the buffer.
fn flush(mut out strings.Builder) ! {
	mut stdout := os.stdout()
	stdout.write(out)!
	out.clear()
}
