// Primes sieve: count, sum and find the largest prime up to N with the Sieve of Eratosthenes.
module main

import os
import strconv

const max_limit = u64(200_000_000)
const usage = 'usage: primes-sieve N  (N: 0..200000000)'

// Summary is the result of scanning the sieve.
struct Summary {
mut:
	count   u64
	sum     u64
	largest u64
}

fn main() {
	n := parse_limit(os.args[1..]) or {
		eprintln(usage)
		exit(1)
	}

	write_summary(summarize(sieve(n))) or {
		eprintln('primes-sieve: ${err}')
		exit(1)
	}
}

// parse_limit accepts exactly one argument made only of ASCII digits.
fn parse_limit(args []string) ?int {
	if args.len != 1 || args[0] == '' {
		return none
	}

	for c in args[0] {
		if !c.is_digit() {
			return none
		}
	}

	n := strconv.parse_uint(args[0], 10, 64) or { return none }

	if n > max_limit {
		return none
	}

	return int(n)
}

// sieve returns one flag per integer 0..n; is_prime[i] is true when i is prime.
// V's int is 32 bits: p * p and m + p stay below 2^31 for n <= 200000000.
fn sieve(n int) []bool {
	mut is_prime := []bool{len: n + 1, init: index >= 2} // 0 and 1 are not prime

	for p := 2; p * p <= n; p++ {
		if !is_prime[p] {
			continue
		}

		for m := p * p; m <= n; m += p {
			is_prime[m] = false
		}
	}

	return is_prime
}

// summarize counts and sums the primes and finds the largest one (0 when there is none).
fn summarize(is_prime []bool) Summary {
	mut s := Summary{}

	for i, prime in is_prime {
		if prime {
			s.count++
			s.sum += u64(i)
			s.largest = u64(i)
		}
	}

	return s
}

// write_summary formats the three result lines and writes them to stdout at once.
fn write_summary(s Summary) ! {
	mut stdout := os.stdout()
	stdout.write_string('count: ${s.count}\nsum: ${s.sum}\nlargest: ${s.largest}\n')!
}
