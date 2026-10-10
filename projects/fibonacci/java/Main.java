// Fibonacci: print the first N Fibonacci numbers (mod 2^64), one per line.

import java.io.BufferedOutputStream;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.OptionalLong;

public final class Main {
    private static final long MAX_COUNT = 1_000_000_000L;
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final String USAGE = "usage: fibonacci N  (N: 0..1000000000)";

    private Main() {
    }

    public static void main(String[] args) {
        var n = parseCount(args);

        if (n.isEmpty()) {
            System.err.println(USAGE);
            System.exit(1);
        }

        try (var out = new BufferedOutputStream(new FileOutputStream(FileDescriptor.out), BUFFER_SIZE)) {
            writeFibonacci(out, n.getAsLong());
        } catch (IOException e) {
            System.err.println("fibonacci: " + e.getMessage());
            System.exit(1);
        }
    }

    /** Accepts exactly one argument made only of ASCII digits (Long.parseLong alone accepts '+'). */
    static OptionalLong parseCount(String[] args) {
        if (args.length != 1 || !isDigits(args[0])) {
            return OptionalLong.empty();
        }

        try {
            long n = Long.parseLong(args[0]);
            return n <= MAX_COUNT ? OptionalLong.of(n) : OptionalLong.empty();
        } catch (NumberFormatException e) {
            return OptionalLong.empty(); // more digits than a long can hold
        }
    }

    private static boolean isDigits(String text) {
        return !text.isEmpty() && text.chars().allMatch(c -> c >= '0' && c <= '9');
    }

    /** Writes F(0)..F(n-1); long addition wraps modulo 2^64 (two's complement). */
    static void writeFibonacci(OutputStream out, long n) throws IOException {
        long a = 0;
        long b = 1;
        var chunk = new StringBuilder(BUFFER_SIZE + 32);

        for (long i = 0; i < n; i++) {
            chunk.append(Long.toUnsignedString(a)).append('\n');

            if (chunk.length() >= BUFFER_SIZE) {
                writeChunk(out, chunk);
            }

            long next = a + b;
            a = b;
            b = next;
        }

        writeChunk(out, chunk);
    }

    /** Writes the chunk as ASCII bytes and empties it for reuse. */
    private static void writeChunk(OutputStream out, StringBuilder chunk) throws IOException {
        out.write(chunk.toString().getBytes(StandardCharsets.US_ASCII));
        chunk.setLength(0);
    }
}
