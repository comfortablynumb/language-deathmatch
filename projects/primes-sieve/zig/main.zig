//! Primes sieve: count, sum and find the largest prime up to N with the Sieve of Eratosthenes.

const std = @import("std");
const Io = std.Io;
const Allocator = std.mem.Allocator;

const max_limit: usize = 200_000_000;
const usage = "usage: primes-sieve N  (N: 0..200000000)\n";

/// The result of scanning the sieve.
const Summary = struct {
    count: u64 = 0,
    sum: u64 = 0,
    largest: u64 = 0,
};

pub fn main(init: std.process.Init) !u8 {
    const args = try init.minimal.args.toSlice(init.arena.allocator());

    const n = parseLimit(args) orelse {
        Io.File.stderr().writeStreamingAll(init.io, usage) catch {};
        return 1;
    };

    const is_prime = try sieve(init.gpa, n);
    defer init.gpa.free(is_prime);
    const summary = summarize(is_prime);

    var buffer: [4096]u8 = undefined;
    var stdout = Io.File.stdout().writerStreaming(init.io, &buffer);
    writeSummary(&stdout.interface, summary) catch |err| return stdout.err orelse err;
    return 0;
}

/// Accepts exactly one argument (after the program name) made only of ASCII digits
/// (`std.fmt.parseInt` alone would also accept a sign and `_` digit separators).
fn parseLimit(args: []const [:0]const u8) ?usize {
    if (args.len != 2 or args[1].len == 0) return null;

    for (args[1]) |c| {
        if (!std.ascii.isDigit(c)) return null;
    }

    const n = std.fmt.parseInt(usize, args[1], 10) catch return null;

    if (n > max_limit) return null;
    return n;
}

/// Returns one flag per integer 0..n (caller frees); `is_prime[i]` is true when i is prime.
fn sieve(gpa: Allocator, n: usize) Allocator.Error![]bool {
    const is_prime = try gpa.alloc(bool, n + 1);
    @memset(is_prime, true);
    is_prime[0] = false;

    if (n >= 1) is_prime[1] = false;

    var p: usize = 2;

    while (p * p <= n) : (p += 1) {
        if (!is_prime[p]) continue;

        var multiple = p * p;

        while (multiple <= n) : (multiple += p) {
            is_prime[multiple] = false;
        }
    }

    return is_prime;
}

/// Counts and sums the primes and finds the largest one (0 when there is none).
fn summarize(is_prime: []const bool) Summary {
    var summary: Summary = .{};

    for (is_prime, 0..) |prime, i| {
        if (prime) {
            summary.count += 1;
            summary.sum += i;
            summary.largest = i;
        }
    }

    return summary;
}

/// Writes the three result lines and flushes.
fn writeSummary(out: *Io.Writer, summary: Summary) Io.Writer.Error!void {
    try out.print("count: {d}\n", .{summary.count});
    try out.print("sum: {d}\n", .{summary.sum});
    try out.print("largest: {d}\n", .{summary.largest});
    try out.flush();
}
