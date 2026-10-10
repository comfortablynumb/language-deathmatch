// Binary trees: allocate, walk and discard perfect binary trees (Benchmarks Game, sequential).

import java.io.BufferedOutputStream;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.OptionalInt;

public final class Main {
    private static final int MIN_DEPTH = 4;
    private static final int MAX_INPUT = 21;
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final String USAGE = "usage: binary-trees N  (N: 0..21)";

    /** One heap-allocated tree node; a leaf has null children. */
    record Node(Node left, Node right) {
        /** Walks the whole tree and returns its node count. */
        int check() {
            if (left == null) {
                return 1;
            }

            return 1 + left.check() + right.check();
        }
    }

    private Main() {
    }

    public static void main(String[] args) {
        var n = parseDepth(args);

        if (n.isEmpty()) {
            System.err.println(USAGE);
            System.exit(1);
        }

        try (var out = new BufferedOutputStream(new FileOutputStream(FileDescriptor.out), BUFFER_SIZE)) {
            run(out, n.getAsInt());
        } catch (IOException e) {
            System.err.println("binary-trees: " + e.getMessage());
            System.exit(1);
        }
    }

    /** Accepts exactly one argument made only of ASCII digits (Integer.parseInt alone accepts '+'). */
    static OptionalInt parseDepth(String[] args) {
        if (args.length != 1 || !isDigits(args[0])) {
            return OptionalInt.empty();
        }

        try {
            int n = Integer.parseInt(args[0]);
            return n <= MAX_INPUT ? OptionalInt.of(n) : OptionalInt.empty();
        } catch (NumberFormatException e) {
            return OptionalInt.empty(); // more digits than an int can hold
        }
    }

    private static boolean isDigits(String text) {
        return !text.isEmpty() && text.chars().allMatch(c -> c >= '0' && c <= '9');
    }

    /** Allocates a perfect tree of the given depth, children before their parent. */
    static Node bottomUpTree(int depth) {
        if (depth == 0) {
            return new Node(null, null);
        }

        return new Node(bottomUpTree(depth - 1), bottomUpTree(depth - 1));
    }

    /** Prints the stretch tree, one line per iteration depth and the long-lived tree. */
    static void run(OutputStream out, int n) throws IOException {
        int maxDepth = Math.max(MIN_DEPTH + 2, n);
        int stretchDepth = maxDepth + 1;

        int stretch = bottomUpTree(stretchDepth).check();
        writeLine(out, "stretch tree of depth " + stretchDepth + "\t check: " + stretch);

        var longLived = bottomUpTree(maxDepth);

        for (int depth = MIN_DEPTH; depth <= maxDepth; depth += 2) {
            int iterations = 1 << (maxDepth - depth + MIN_DEPTH);
            int sum = sumChecks(depth, iterations);
            writeLine(out, iterations + "\t trees of depth " + depth + "\t check: " + sum);
        }

        writeLine(out, "long lived tree of depth " + maxDepth + "\t check: " + longLived.check());
    }

    /** Builds, checks and drops `iterations` trees of `depth`, one at a time. */
    static int sumChecks(int depth, int iterations) {
        int sum = 0;

        for (int i = 0; i < iterations; i++) {
            sum += bottomUpTree(depth).check();
        }

        return sum;
    }

    private static void writeLine(OutputStream out, String line) throws IOException {
        out.write((line + "\n").getBytes(StandardCharsets.US_ASCII));
    }
}
