//! Binary trees: allocate, walk and discard perfect binary trees (Benchmarks Game, sequential).

use std::env;
use std::io::{self, BufWriter, Write};
use std::process::ExitCode;

const MIN_DEPTH: u32 = 4;
const MAX_INPUT: u32 = 21;
const USAGE: &str = "usage: binary-trees N  (N: 0..21)";

/// One heap-allocated tree node; a leaf has no children.
struct Node {
    left: Option<Box<Node>>,
    right: Option<Box<Node>>,
}

impl Node {
    /// Allocates a perfect tree of the given depth, children before their parent.
    fn bottom_up(depth: u32) -> Box<Node> {
        if depth == 0 {
            return Box::new(Node {
                left: None,
                right: None,
            });
        }

        let left = Node::bottom_up(depth - 1);
        let right = Node::bottom_up(depth - 1);
        Box::new(Node {
            left: Some(left),
            right: Some(right),
        })
    }

    /// Walks the whole tree and returns its node count.
    fn check(&self) -> u32 {
        match (&self.left, &self.right) {
            (Some(left), Some(right)) => 1 + left.check() + right.check(),
            _ => 1,
        }
    }
}

fn main() -> ExitCode {
    let args: Vec<String> = env::args().skip(1).collect();

    let Some(n) = parse_depth(&args) else {
        eprintln!("{USAGE}");
        return ExitCode::FAILURE;
    };

    let stdout = io::stdout();
    let mut out = BufWriter::with_capacity(64 * 1024, stdout.lock());

    match run(&mut out, n) {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("binary-trees: {err}");
            ExitCode::FAILURE
        }
    }
}

/// Accepts exactly one argument made only of ASCII digits
/// (`str::parse` alone would also accept a leading `+`).
fn parse_depth(args: &[String]) -> Option<u32> {
    let [arg] = args else {
        return None;
    };

    if arg.is_empty() || !arg.bytes().all(|c| c.is_ascii_digit()) {
        return None;
    }

    arg.parse::<u32>().ok().filter(|&n| n <= MAX_INPUT)
}

/// Prints the stretch tree, one line per iteration depth and the long-lived tree.
fn run<W: Write>(out: &mut W, n: u32) -> io::Result<()> {
    let max_depth = n.max(MIN_DEPTH + 2);
    let stretch_depth = max_depth + 1;

    let stretch = Node::bottom_up(stretch_depth).check();
    writeln!(
        out,
        "stretch tree of depth {stretch_depth}\t check: {stretch}"
    )?;

    let long_lived = Node::bottom_up(max_depth);

    for depth in (MIN_DEPTH..=max_depth).step_by(2) {
        let iterations = 1u32 << (max_depth - depth + MIN_DEPTH);
        let sum = sum_checks(depth, iterations);
        writeln!(out, "{iterations}\t trees of depth {depth}\t check: {sum}")?;
    }

    let check = long_lived.check();
    writeln!(out, "long lived tree of depth {max_depth}\t check: {check}")?;
    out.flush()
}

/// Builds, checks and drops `iterations` trees of `depth`, one at a time.
fn sum_checks(depth: u32, iterations: u32) -> u32 {
    (0..iterations)
        .map(|_| Node::bottom_up(depth).check())
        .sum()
}
