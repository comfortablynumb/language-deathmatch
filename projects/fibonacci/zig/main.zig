//! Fibonacci: print the first N Fibonacci numbers (mod 2^64), one per line.

const std = @import("std");
const Io = std.Io;

const max_count: u64 = 1_000_000_000;
const usage = "usage: fibonacci N  (N: 0..1000000000)\n";

pub fn main(init: std.process.Init) !u8 {
    const args = try init.minimal.args.toSlice(init.arena.allocator());

    const n = parseCount(args) orelse {
        Io.File.stderr().writeStreamingAll(init.io, usage) catch {};
        return 1;
    };

    var buffer: [64 * 1024]u8 = undefined;
    var stdout = Io.File.stdout().writerStreaming(init.io, &buffer);
    writeFibonacci(&stdout.interface, n) catch |err| return stdout.err orelse err;
    return 0;
}

/// Accepts exactly one argument (after the program name) made only of ASCII digits
/// (`std.fmt.parseInt` alone would also accept a sign and `_` digit separators).
fn parseCount(args: []const [:0]const u8) ?u64 {
    if (args.len != 2 or args[1].len == 0) return null;

    for (args[1]) |c| {
        if (!std.ascii.isDigit(c)) return null;
    }

    const n = std.fmt.parseInt(u64, args[1], 10) catch return null;

    if (n > max_count) return null;
    return n;
}

/// Writes F(0)..F(n-1); `+%` is wrapping (mod 2^64) addition.
fn writeFibonacci(out: *Io.Writer, n: u64) Io.Writer.Error!void {
    var a: u64 = 0;
    var b: u64 = 1;

    for (0..n) |_| {
        try out.print("{d}\n", .{a});
        // Not `a, b = .{ b, a +% b }`: destructuring writes a before a +% b reads it.
        const next = a +% b;
        a = b;
        b = next;
    }

    try out.flush();
}
