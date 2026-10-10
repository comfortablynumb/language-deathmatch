// Mandelbrot: render the Mandelbrot set as an N×N binary PBM (P4) bitmap.

import java.io.BufferedOutputStream;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.OptionalInt;

public final class Main {
    private static final int MAX_SIZE = 16_000;
    private static final int MAX_ITERATIONS = 50;
    private static final double LIMIT = 4.0;
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final String USAGE = "usage: mandelbrot N  (N: 1..16000)";

    private Main() {
    }

    public static void main(String[] args) {
        var n = parseSize(args);

        if (n.isEmpty()) {
            System.err.println(USAGE);
            System.exit(1);
        }

        try (var out = new BufferedOutputStream(new FileOutputStream(FileDescriptor.out), BUFFER_SIZE)) {
            writeImage(out, n.getAsInt());
        } catch (IOException e) {
            System.err.println("mandelbrot: " + e.getMessage());
            System.exit(1);
        }
    }

    /** Accepts exactly one argument made only of ASCII digits, 1..MAX_SIZE (Integer.parseInt alone accepts '+'). */
    static OptionalInt parseSize(String[] args) {
        if (args.length != 1 || !isDigits(args[0])) {
            return OptionalInt.empty();
        }

        try {
            int n = Integer.parseInt(args[0]);
            return n >= 1 && n <= MAX_SIZE ? OptionalInt.of(n) : OptionalInt.empty();
        } catch (NumberFormatException e) {
            return OptionalInt.empty(); // more digits than an int can hold
        }
    }

    private static boolean isDigits(String text) {
        return !text.isEmpty() && text.chars().allMatch(c -> c >= '0' && c <= '9');
    }

    /** Writes the PBM header, then the n rows of the bitmap from top to bottom. */
    static void writeImage(OutputStream out, int n) throws IOException {
        out.write(("P4\n" + n + " " + n + "\n").getBytes(StandardCharsets.US_ASCII));

        var row = new byte[(n + 7) / 8];

        for (int y = 0; y < n; y++) {
            renderRow(row, y, n);
            out.write(row);
        }
    }

    /** Packs the n pixels of row y into row, 8 per byte, most significant bit first. */
    static void renderRow(byte[] row, int y, int n) {
        double size = n;
        double ci = 2.0 * y / size - 1.0;
        Arrays.fill(row, (byte) 0);

        for (int x = 0; x < n; x++) {
            double cr = 2.0 * x / size - 1.5;

            if (inSet(cr, ci)) {
                row[x >> 3] |= (byte) (0x80 >>> (x & 7));
            }
        }
    }

    /**
     * Iterates z = z² + c up to MAX_ITERATIONS times and reports whether |z|² stayed ≤ 4.
     * Java evaluates left to right and rounds every operation on its own: it never contracts
     * a * b + c into a fused multiply-add (only an explicit Math.fma would).
     */
    static boolean inSet(double cr, double ci) {
        double zr = 0.0;
        double zi = 0.0;
        double tr = 0.0;
        double ti = 0.0;

        for (int i = 0; i < MAX_ITERATIONS && tr + ti <= LIMIT; i++) {
            zi = 2.0 * zr * zi + ci;
            zr = tr - ti + cr;
            tr = zr * zr;
            ti = zi * zi;
        }

        return tr + ti <= LIMIT;
    }
}
