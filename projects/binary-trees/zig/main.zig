//! Binary trees: allocate, walk and discard perfect binary trees (Benchmarks Game, sequential).

const std = @import("std");
const Io = std.Io;
const Allocator = std.mem.Allocator;

const min_depth: u32 = 4;
const max_input: u32 = 21;
const usage = "usage: binary-trees N  (N: 0..21)\n";

/// One heap-allocated tree node; a leaf has no children.
const Node = struct {
    left: ?*Node,
    right: ?*Node,

    /// Allocates a perfect tree of the given depth, children before their parent.
    fn bottomUp(gpa: Allocator, depth: u32) Allocator.Error!*Node {
        if (depth == 0) return create(gpa, null, null);

        const left = try bottomUp(gpa, depth - 1);
        errdefer left.destroy(gpa);
        const right = try bottomUp(gpa, depth - 1);
        errdefer right.destroy(gpa);
        return create(gpa, left, right);
    }

    /// Allocates one node on its own (one allocation per node).
    fn create(gpa: Allocator, left: ?*Node, right: ?*Node) Allocator.Error!*Node {
        const node = try gpa.create(Node);
        node.* = .{ .left = left, .right = right };
        return node;
    }

    /// Walks the whole tree and returns its node count.
    fn check(node: *const Node) u32 {
        const left = node.left orelse return 1;
        return 1 + left.check() + node.right.?.check();
    }

    /// Frees the whole tree, node by node, children before their parent.
    fn destroy(node: *Node, gpa: Allocator) void {
        if (node.left) |left| left.destroy(gpa);

        if (node.right) |right| right.destroy(gpa);

        gpa.destroy(node);
    }
};

pub fn main(init: std.process.Init) !u8 {
    const args = try init.minimal.args.toSlice(init.arena.allocator());

    const n = parseDepth(args) orelse {
        Io.File.stderr().writeStreamingAll(init.io, usage) catch {};
        return 1;
    };

    var buffer: [64 * 1024]u8 = undefined;
    var stdout = Io.File.stdout().writerStreaming(init.io, &buffer);
    run(init.gpa, &stdout.interface, n) catch |err| return stdout.err orelse err;
    return 0;
}

/// Accepts exactly one argument (after the program name) made only of ASCII digits
/// (`std.fmt.parseInt` alone would also accept a sign and `_` digit separators).
fn parseDepth(args: []const [:0]const u8) ?u32 {
    if (args.len != 2 or args[1].len == 0) return null;

    for (args[1]) |c| {
        if (!std.ascii.isDigit(c)) return null;
    }

    const n = std.fmt.parseInt(u32, args[1], 10) catch return null;

    if (n > max_input) return null;
    return n;
}

/// Prints the stretch tree, one line per iteration depth and the long-lived tree.
fn run(gpa: Allocator, out: *Io.Writer, n: u32) !void {
    const max_depth = @max(n, min_depth + 2);
    const stretch_depth = max_depth + 1;

    const stretch = try checkOnce(gpa, stretch_depth);
    try out.print("stretch tree of depth {d}\t check: {d}\n", .{ stretch_depth, stretch });

    const long_lived = try Node.bottomUp(gpa, max_depth);
    defer long_lived.destroy(gpa);
    var depth = min_depth;

    while (depth <= max_depth) : (depth += 2) {
        const iterations = @as(u32, 1) << @intCast(max_depth - depth + min_depth);
        const sum = try sumChecks(gpa, depth, iterations);
        try out.print("{d}\t trees of depth {d}\t check: {d}\n", .{ iterations, depth, sum });
    }

    const check = long_lived.check();
    try out.print("long lived tree of depth {d}\t check: {d}\n", .{ max_depth, check });
    try out.flush();
}

/// Builds a tree of `depth`, checks it and frees it.
fn checkOnce(gpa: Allocator, depth: u32) Allocator.Error!u32 {
    const tree = try Node.bottomUp(gpa, depth);
    defer tree.destroy(gpa);
    return tree.check();
}

/// Builds, checks and frees `iterations` trees of `depth`, one at a time.
fn sumChecks(gpa: Allocator, depth: u32, iterations: u32) Allocator.Error!u32 {
    var sum: u32 = 0;

    for (0..iterations) |_| {
        sum += try checkOnce(gpa, depth);
    }

    return sum;
}
