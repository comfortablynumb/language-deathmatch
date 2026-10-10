//! Mandelbrot: render the Mandelbrot set as an N×N binary PBM (P4) bitmap.

const std = @import("std");
const Io = std.Io;

const max_size: u32 = 16_000;
const max_iterations = 50;
const limit: f64 = 4.0;
const usage = "usage: mandelbrot N  (N: 1..16000)\n";

pub fn main(init: std.process.Init) !u8 {
    const args = try init.minimal.args.toSlice(init.arena.allocator());

    const n = parseSize(args) orelse {
        Io.File.stderr().writeStreamingAll(init.io, usage) catch {};
        return 1;
    };

    var buffer: [64 * 1024]u8 = undefined;
    var stdout = Io.File.stdout().writerStreaming(init.io, &buffer);
    writeImage(&stdout.interface, n) catch |err| return stdout.err orelse err;
    return 0;
}

/// Accepts exactly one argument (after the program name) made only of ASCII digits, 1..max_size
/// (`std.fmt.parseInt` alone would also accept a sign and `_` digit separators).
fn parseSize(args: []const [:0]const u8) ?u32 {
    if (args.len != 2 or args[1].len == 0) return null;

    for (args[1]) |c| {
        if (!std.ascii.isDigit(c)) return null;
    }

    const n = std.fmt.parseInt(u32, args[1], 10) catch return null;

    if (n < 1 or n > max_size) return null;
    return n;
}

/// Writes the PBM header, then the n rows of the bitmap from top to bottom.
fn writeImage(out: *Io.Writer, n: u32) Io.Writer.Error!void {
    var row_buffer: [(max_size + 7) / 8]u8 = undefined;
    const row = row_buffer[0 .. (n + 7) / 8];
    try out.print("P4\n{d} {d}\n", .{ n, n });

    for (0..n) |y| {
        renderRow(row, @intCast(y), n);
        try out.writeAll(row);
    }

    try out.flush();
}

/// Packs the n pixels of row y into `row`, 8 per byte, most significant bit first.
/// `@floatFromInt` converts these small integers to f64 exactly.
fn renderRow(row: []u8, y: u32, n: u32) void {
    const size: f64 = @floatFromInt(n);
    const ci = 2.0 * @as(f64, @floatFromInt(y)) / size - 1.0;
    @memset(row, 0);

    for (0..n) |x| {
        const cr = 2.0 * @as(f64, @floatFromInt(x)) / size - 1.5;

        if (inSet(cr, ci)) {
            const bit: u3 = @intCast(x % 8);
            row[x / 8] |= @as(u8, 0x80) >> bit;
        }
    }
}

/// Iterates z = z² + c up to `max_iterations` times; true if |z|² stayed ≤ 4.
/// The default (strict) float mode never contracts a * b + c into an FMA: every operation rounds.
fn inSet(cr: f64, ci: f64) bool {
    var zr: f64 = 0.0;
    var zi: f64 = 0.0;
    var tr: f64 = 0.0;
    var ti: f64 = 0.0;

    for (0..max_iterations) |_| {
        if (tr + ti > limit) break;

        zi = 2.0 * zr * zi + ci;
        zr = tr - ti + cr;
        tr = zr * zr;
        ti = zi * zi;
    }

    return tr + ti <= limit;
}
