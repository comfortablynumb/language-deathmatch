//! Fasta: generate three DNA sequences in FASTA format (Benchmarks Game, sequential).

use std::env;
use std::io::{self, BufWriter, Write};
use std::process::ExitCode;

const MAX_COUNT: usize = 25_000_000;
const LINE_WIDTH: usize = 60;
const USAGE: &str = "usage: fasta N  (N: 0..25000000)";

// Linear congruential generator: seed = (seed * IA + IC) % IM.
const IM: u32 = 139_968;
const IA: u32 = 3_877;
const IC: u32 = 29_573;
const SEED: u32 = 42;

const ALU: &[u8] = concat!(
    "GGCCGGGCGCGGTGGCTCACGCCTGTAATCCCAGCACTTTGG",
    "GAGGCCGAGGCGGGCGGATCACCTGAGGTCAGGAGTTCGAGA",
    "CCAGCCTGGCCAACATGGTGAAACCCCGTCTCTACTAAAAAT",
    "ACAAAAATTAGCCGGGCGTGGTGGCGCGCGCCTGTAATCCCA",
    "GCTACTCGGGAGGCTGAGGCAGGAGAATCGCTTGAACCCGGG",
    "AGGCGGAGGTTGCAGTGAGCCGAGATCGCGCCACTGCACTCC",
    "AGCCTGGGCGACAGAGCGAGACTCCGTCTCAAAAA",
)
.as_bytes();

#[rustfmt::skip]
const IUB: [(u8, f64); 15] = [
    (b'a', 0.27), (b'c', 0.12), (b'g', 0.12), (b't', 0.27),
    (b'B', 0.02), (b'D', 0.02), (b'H', 0.02), (b'K', 0.02), (b'M', 0.02),
    (b'N', 0.02), (b'R', 0.02), (b'S', 0.02), (b'V', 0.02), (b'W', 0.02), (b'Y', 0.02),
];

const HOMO_SAPIENS: [(u8, f64); 4] = [
    (b'a', 0.302_954_942_668_0),
    (b'c', 0.197_988_300_492_1),
    (b'g', 0.197_547_306_639_1),
    (b't', 0.301_509_450_200_8),
];

/// Symbols with their cumulative probabilities, in table order.
struct Table {
    symbols: Vec<u8>,
    cumulative: Vec<f64>,
}

impl Table {
    fn new(entries: &[(u8, f64)]) -> Self {
        let symbols = entries.iter().map(|&(symbol, _)| symbol).collect();
        let cumulative = entries
            .iter()
            .scan(0.0, |sum, &(_, probability)| {
                *sum += probability;
                Some(*sum)
            })
            .collect();

        Self {
            symbols,
            cumulative,
        }
    }

    /// The first symbol whose cumulative probability exceeds `r`, else the last one.
    fn pick(&self, r: f64) -> u8 {
        match self.cumulative.iter().position(|&c| r < c) {
            Some(i) => self.symbols[i],
            None => self.symbols[self.symbols.len() - 1],
        }
    }
}

/// The generator shared by records TWO and THREE.
struct Random {
    seed: u32,
}

impl Random {
    /// Advances the generator and returns `seed / IM` in [0, 1).
    fn next(&mut self) -> f64 {
        self.seed = (self.seed * IA + IC) % IM; // below 2^30: no overflow
        f64::from(self.seed) / f64::from(IM)
    }
}

fn main() -> ExitCode {
    let args: Vec<String> = env::args().skip(1).collect();

    let Some(n) = parse_count(&args) else {
        eprintln!("{USAGE}");
        return ExitCode::FAILURE;
    };

    let stdout = io::stdout();
    let mut out = BufWriter::with_capacity(64 * 1024, stdout.lock());

    match write_fasta(&mut out, n) {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("fasta: {err}");
            ExitCode::FAILURE
        }
    }
}

/// Accepts exactly one argument made only of ASCII digits
/// (`str::parse` alone would also accept a leading `+`).
fn parse_count(args: &[String]) -> Option<usize> {
    let [arg] = args else {
        return None;
    };

    if arg.is_empty() || !arg.bytes().all(|c| c.is_ascii_digit()) {
        return None;
    }

    arg.parse::<usize>().ok().filter(|&n| n <= MAX_COUNT)
}

/// Writes the three records; one generator serves both random ones.
fn write_fasta<W: Write>(out: &mut W, n: usize) -> io::Result<()> {
    let mut rng = Random { seed: SEED };

    out.write_all(b">ONE Homo sapiens alu\n")?;
    write_repeat(out, ALU, 2 * n)?;
    out.write_all(b">TWO IUB ambiguity codes\n")?;
    write_random(out, &mut rng, &Table::new(&IUB), 3 * n)?;
    out.write_all(b">THREE Homo sapiens frequency\n")?;
    write_random(out, &mut rng, &Table::new(&HOMO_SAPIENS), 5 * n)?;
    out.flush()
}

/// Writes `n` characters of `s` repeated cyclically, `LINE_WIDTH` per line.
fn write_repeat<W: Write>(out: &mut W, s: &[u8], n: usize) -> io::Result<()> {
    let extended = [s, &s[..LINE_WIDTH]].concat(); // a line starting anywhere in s never wraps
    let mut pos = 0;
    let mut left = n;

    while left > 0 {
        let count = left.min(LINE_WIDTH);
        out.write_all(&extended[pos..pos + count])?;
        out.write_all(b"\n")?;
        pos = (pos + count) % s.len();
        left -= count;
    }

    Ok(())
}

/// Writes `n` symbols picked from `table`, one generator step each, `LINE_WIDTH` per line.
fn write_random<W: Write>(
    out: &mut W,
    rng: &mut Random,
    table: &Table,
    n: usize,
) -> io::Result<()> {
    let mut line = [0u8; LINE_WIDTH + 1];
    let mut left = n;

    while left > 0 {
        let count = left.min(LINE_WIDTH);

        for slot in &mut line[..count] {
            *slot = table.pick(rng.next());
        }

        line[count] = b'\n';
        out.write_all(&line[..=count])?;
        left -= count;
    }

    Ok(())
}
