//! Mandelbrot: render the Mandelbrot set as an N×N binary PBM (P4) bitmap.

use std::env;
use std::io::{self, BufWriter, Write};
use std::process::ExitCode;

const MAX_SIZE: u32 = 16_000;
const MAX_ITERATIONS: u32 = 50;
const LIMIT: f64 = 4.0;
const USAGE: &str = "usage: mandelbrot N  (N: 1..16000)";

fn main() -> ExitCode {
    let args: Vec<String> = env::args().skip(1).collect();

    let Some(n) = parse_size(&args) else {
        eprintln!("{USAGE}");
        return ExitCode::FAILURE;
    };

    let stdout = io::stdout();
    let mut out = BufWriter::with_capacity(64 * 1024, stdout.lock());

    match write_image(&mut out, n) {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("mandelbrot: {err}");
            ExitCode::FAILURE
        }
    }
}

/// Accepts exactly one argument made only of ASCII digits, `1..=MAX_SIZE`
/// (`str::parse` alone would also accept a leading `+`).
fn parse_size(args: &[String]) -> Option<u32> {
    let [arg] = args else {
        return None;
    };

    if arg.is_empty() || !arg.bytes().all(|c| c.is_ascii_digit()) {
        return None;
    }

    arg.parse::<u32>()
        .ok()
        .filter(|n| (1..=MAX_SIZE).contains(n))
}

/// Writes the PBM header, then the n rows of the bitmap from top to bottom.
fn write_image<W: Write>(out: &mut W, n: u32) -> io::Result<()> {
    write!(out, "P4\n{n} {n}\n")?;
    let mut row = vec![0u8; n.div_ceil(8) as usize];

    for y in 0..n {
        render_row(&mut row, y, n);
        out.write_all(&row)?;
    }

    out.flush()
}

/// Packs the n pixels of row y into `row`, 8 per byte, most significant bit first.
/// `f64::from(u32)` converts exactly.
fn render_row(row: &mut [u8], y: u32, n: u32) {
    let size = f64::from(n);
    let ci = 2.0 * f64::from(y) / size - 1.0;
    row.fill(0);

    for x in 0..n {
        let cr = 2.0 * f64::from(x) / size - 1.5;

        if in_set(cr, ci) {
            row[(x / 8) as usize] |= 0x80 >> (x % 8);
        }
    }
}

/// Iterates z = z² + c up to `MAX_ITERATIONS` times; true if |z|² stayed ≤ 4.
/// Rust never contracts a * b + c into an FMA on its own, so every operation rounds.
fn in_set(cr: f64, ci: f64) -> bool {
    let (mut zr, mut zi, mut tr, mut ti) = (0.0_f64, 0.0_f64, 0.0_f64, 0.0_f64);

    for _ in 0..MAX_ITERATIONS {
        if tr + ti > LIMIT {
            break;
        }

        zi = 2.0 * zr * zi + ci;
        zr = tr - ti + cr;
        tr = zr * zr;
        ti = zi * zi;
    }

    tr + ti <= LIMIT
}
