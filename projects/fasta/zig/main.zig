//! Fasta: generate three DNA sequences in FASTA format (Benchmarks Game, sequential).

const std = @import("std");
const Io = std.Io;

const max_count: usize = 25_000_000;
const line_width = 60;
const usage = "usage: fasta N  (N: 0..25000000)\n";

// Linear congruential generator: seed = (seed * ia + ic) % im.
const im: u32 = 139_968;
const ia: u32 = 3_877;
const ic: u32 = 29_573;
const initial_seed: u32 = 42;

const alu = "GGCCGGGCGCGGTGGCTCACGCCTGTAATCCCAGCACTTTGG" ++
    "GAGGCCGAGGCGGGCGGATCACCTGAGGTCAGGAGTTCGAGA" ++
    "CCAGCCTGGCCAACATGGTGAAACCCCGTCTCTACTAAAAAT" ++
    "ACAAAAATTAGCCGGGCGTGGTGGCGCGCGCCTGTAATCCCA" ++
    "GCTACTCGGGAGGCTGAGGCAGGAGAATCGCTTGAACCCGGG" ++
    "AGGCGGAGGTTGCAGTGAGCCGAGATCGCGCCACTGCACTCC" ++
    "AGCCTGGGCGACAGAGCGAGACTCCGTCTCAAAAA";

/// One table entry: a symbol and its probability.
const Entry = struct { symbol: u8, probability: f64 };

const iub = [_]Entry{
    .{ .symbol = 'a', .probability = 0.27 }, .{ .symbol = 'c', .probability = 0.12 },
    .{ .symbol = 'g', .probability = 0.12 }, .{ .symbol = 't', .probability = 0.27 },
    .{ .symbol = 'B', .probability = 0.02 }, .{ .symbol = 'D', .probability = 0.02 },
    .{ .symbol = 'H', .probability = 0.02 }, .{ .symbol = 'K', .probability = 0.02 },
    .{ .symbol = 'M', .probability = 0.02 }, .{ .symbol = 'N', .probability = 0.02 },
    .{ .symbol = 'R', .probability = 0.02 }, .{ .symbol = 'S', .probability = 0.02 },
    .{ .symbol = 'V', .probability = 0.02 }, .{ .symbol = 'W', .probability = 0.02 },
    .{ .symbol = 'Y', .probability = 0.02 },
};

const homo_sapiens = [_]Entry{
    .{ .symbol = 'a', .probability = 0.3029549426680 },
    .{ .symbol = 'c', .probability = 0.1979883004921 },
    .{ .symbol = 'g', .probability = 0.1975473066391 },
    .{ .symbol = 't', .probability = 0.3015094502008 },
};

/// Symbols with their cumulative probabilities, in table order.
fn Table(comptime len: usize) type {
    return struct {
        symbols: [len]u8,
        cumulative: [len]f64,

        /// Sums the probabilities as f64 (typed, so every addition rounds to double).
        fn init(entries: [len]Entry) @This() {
            var table: @This() = undefined;
            var sum: f64 = 0.0;

            for (entries, 0..) |entry, i| {
                sum += entry.probability;
                table.symbols[i] = entry.symbol;
                table.cumulative[i] = sum;
            }

            return table;
        }

        /// The first symbol whose cumulative probability exceeds `r`, else the last one.
        fn pick(table: *const @This(), r: f64) u8 {
            for (table.cumulative, table.symbols) |c, symbol| {
                if (r < c) return symbol;
            }

            return table.symbols[len - 1];
        }
    };
}

/// The generator shared by records TWO and THREE.
const Random = struct {
    seed: u32 = initial_seed,

    /// Advances the generator and returns `seed / im` in [0, 1).
    fn next(rng: *Random) f64 {
        rng.seed = (rng.seed * ia + ic) % im; // below 2^30: no overflow
        return @as(f64, @floatFromInt(rng.seed)) / @as(f64, @floatFromInt(im));
    }
};

pub fn main(init: std.process.Init) !u8 {
    const args = try init.minimal.args.toSlice(init.arena.allocator());

    const n = parseCount(args) orelse {
        Io.File.stderr().writeStreamingAll(init.io, usage) catch {};
        return 1;
    };

    var buffer: [64 * 1024]u8 = undefined;
    var stdout = Io.File.stdout().writerStreaming(init.io, &buffer);
    writeFasta(&stdout.interface, n) catch |err| return stdout.err orelse err;
    return 0;
}

/// Accepts exactly one argument (after the program name) made only of ASCII digits
/// (`std.fmt.parseInt` alone would also accept a sign and `_` digit separators).
fn parseCount(args: []const [:0]const u8) ?usize {
    if (args.len != 2 or args[1].len == 0) return null;

    for (args[1]) |c| {
        if (!std.ascii.isDigit(c)) return null;
    }

    const n = std.fmt.parseInt(usize, args[1], 10) catch return null;

    if (n > max_count) return null;
    return n;
}

/// Writes the three records; one generator serves both random ones.
/// Both cumulative tables are computed at compile time.
fn writeFasta(out: *Io.Writer, n: usize) Io.Writer.Error!void {
    const iub_table = comptime Table(iub.len).init(iub);
    const homo_sapiens_table = comptime Table(homo_sapiens.len).init(homo_sapiens);
    var rng: Random = .{};

    try out.writeAll(">ONE Homo sapiens alu\n");
    try writeRepeat(out, 2 * n);
    try out.writeAll(">TWO IUB ambiguity codes\n");
    try writeRandom(out, &rng, &iub_table, 3 * n);
    try out.writeAll(">THREE Homo sapiens frequency\n");
    try writeRandom(out, &rng, &homo_sapiens_table, 5 * n);
    try out.flush();
}

/// Writes `n` characters of the ALU string repeated cyclically, `line_width` per line.
fn writeRepeat(out: *Io.Writer, n: usize) Io.Writer.Error!void {
    const extended = alu ++ alu[0..line_width]; // a line starting anywhere in alu never wraps
    var pos: usize = 0;
    var left = n;

    while (left > 0) {
        const count = @min(left, line_width);
        try out.writeAll(extended[pos .. pos + count]);
        try out.writeByte('\n');
        pos = (pos + count) % alu.len;
        left -= count;
    }
}

/// Writes `n` symbols picked from `table`, one generator step each, `line_width` per line.
fn writeRandom(out: *Io.Writer, rng: *Random, table: anytype, n: usize) Io.Writer.Error!void {
    var line: [line_width + 1]u8 = undefined;
    var left = n;

    while (left > 0) {
        const count = @min(left, line_width);

        for (line[0..count]) |*slot| {
            slot.* = table.pick(rng.next());
        }

        line[count] = '\n';
        try out.writeAll(line[0 .. count + 1]);
        left -= count;
    }
}
