//! Fibonacci: print the first N Fibonacci numbers (mod 2^64), one per line.

use std::env;
use std::io::{self, BufWriter, Write};
use std::process::ExitCode;

const MAX_COUNT: u64 = 1_000_000_000;
const USAGE: &str = "usage: fibonacci N  (N: 0..1000000000)";

fn main() -> ExitCode {
    let args: Vec<String> = env::args().skip(1).collect();

    let Some(n) = parse_count(&args) else {
        eprintln!("{USAGE}");
        return ExitCode::FAILURE;
    };

    let stdout = io::stdout();
    let mut out = BufWriter::with_capacity(64 * 1024, stdout.lock());

    match write_fibonacci(&mut out, n) {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("fibonacci: {err}");
            ExitCode::FAILURE
        }
    }
}

/// Accepts exactly one argument made only of ASCII digits
/// (`str::parse` alone would also accept a leading `+`).
fn parse_count(args: &[String]) -> Option<u64> {
    let [arg] = args else {
        return None;
    };

    if arg.is_empty() || !arg.bytes().all(|c| c.is_ascii_digit()) {
        return None;
    }

    arg.parse::<u64>().ok().filter(|&n| n <= MAX_COUNT)
}

/// Writes F(0)..F(n-1) using wrapping (mod 2^64) addition.
fn write_fibonacci<W: Write>(out: &mut W, n: u64) -> io::Result<()> {
    let (mut a, mut b) = (0u64, 1u64);

    for _ in 0..n {
        writeln!(out, "{a}")?;
        (a, b) = (b, a.wrapping_add(b));
    }

    out.flush()
}
