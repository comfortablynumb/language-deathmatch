//! Primes sieve: count, sum and find the largest prime up to N with the Sieve of Eratosthenes.

use std::env;
use std::io::{self, BufWriter, Write};
use std::process::ExitCode;

const MAX_LIMIT: usize = 200_000_000;
const USAGE: &str = "usage: primes-sieve N  (N: 0..200000000)";

/// The result of scanning the sieve.
struct Summary {
    count: u64,
    sum: u64,
    largest: u64,
}

fn main() -> ExitCode {
    let args: Vec<String> = env::args().skip(1).collect();

    let Some(n) = parse_limit(&args) else {
        eprintln!("{USAGE}");
        return ExitCode::FAILURE;
    };

    let summary = summarize(&sieve(n));
    let stdout = io::stdout();
    let mut out = BufWriter::new(stdout.lock());

    match write_summary(&mut out, &summary) {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("primes-sieve: {err}");
            ExitCode::FAILURE
        }
    }
}

/// Accepts exactly one argument made only of ASCII digits
/// (`str::parse` alone would also accept a leading `+`).
fn parse_limit(args: &[String]) -> Option<usize> {
    let [arg] = args else {
        return None;
    };

    if arg.is_empty() || !arg.bytes().all(|c| c.is_ascii_digit()) {
        return None;
    }

    arg.parse::<usize>().ok().filter(|&n| n <= MAX_LIMIT)
}

/// Returns one flag per integer 0..=n; `is_prime[i]` is true when i is prime.
fn sieve(n: usize) -> Vec<bool> {
    let mut is_prime = vec![true; n + 1];

    for flag in is_prime.iter_mut().take(2) {
        *flag = false; // 0 and 1 are not prime
    }

    for p in 2..=n.isqrt() {
        if !is_prime[p] {
            continue;
        }

        for multiple in (p * p..=n).step_by(p) {
            is_prime[multiple] = false;
        }
    }

    is_prime
}

/// Counts and sums the primes and finds the largest one (0 when there is none).
fn summarize(is_prime: &[bool]) -> Summary {
    let mut summary = Summary { count: 0, sum: 0, largest: 0 };

    for (i, &prime) in is_prime.iter().enumerate() {
        if prime {
            summary.count += 1;
            summary.sum += i as u64;
            summary.largest = i as u64;
        }
    }

    summary
}

/// Writes the three result lines and flushes.
fn write_summary<W: Write>(out: &mut W, summary: &Summary) -> io::Result<()> {
    writeln!(out, "count: {}", summary.count)?;
    writeln!(out, "sum: {}", summary.sum)?;
    writeln!(out, "largest: {}", summary.largest)?;
    out.flush()
}
