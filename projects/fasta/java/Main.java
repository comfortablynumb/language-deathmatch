// Fasta: generate three DNA sequences in FASTA format (Benchmarks Game, sequential).

import java.io.BufferedOutputStream;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.OptionalInt;

public final class Main {
    private static final int MAX_COUNT = 25_000_000;
    private static final int LINE_WIDTH = 60;
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final String USAGE = "usage: fasta N  (N: 0..25000000)";

    // Linear congruential generator: seed = (seed * IA + IC) % IM.
    private static final int IM = 139_968;
    private static final int IA = 3_877;
    private static final int IC = 29_573;
    private static final int INITIAL_SEED = 42;

    private static final String ALU = "GGCCGGGCGCGGTGGCTCACGCCTGTAATCCCAGCACTTTGG"
            + "GAGGCCGAGGCGGGCGGATCACCTGAGGTCAGGAGTTCGAGA"
            + "CCAGCCTGGCCAACATGGTGAAACCCCGTCTCTACTAAAAAT"
            + "ACAAAAATTAGCCGGGCGTGGTGGCGCGCGCCTGTAATCCCA"
            + "GCTACTCGGGAGGCTGAGGCAGGAGAATCGCTTGAACCCGGG"
            + "AGGCGGAGGTTGCAGTGAGCCGAGATCGCGCCACTGCACTCC"
            + "AGCCTGGGCGACAGAGCGAGACTCCGTCTCAAAAA";

    /** One symbol of a frequency table with its probability. */
    record Acid(char symbol, double probability) {
    }

    private static final Acid[] IUB = {
        new Acid('a', 0.27), new Acid('c', 0.12), new Acid('g', 0.12), new Acid('t', 0.27),
        new Acid('B', 0.02), new Acid('D', 0.02), new Acid('H', 0.02), new Acid('K', 0.02),
        new Acid('M', 0.02), new Acid('N', 0.02), new Acid('R', 0.02), new Acid('S', 0.02),
        new Acid('V', 0.02), new Acid('W', 0.02), new Acid('Y', 0.02),
    };

    private static final Acid[] HOMO_SAPIENS = {
        new Acid('a', 0.3029549426680),
        new Acid('c', 0.1979883004921),
        new Acid('g', 0.1975473066391),
        new Acid('t', 0.3015094502008),
    };

    /** Symbols with their cumulative probabilities, in table order. */
    static final class Table {
        private final byte[] symbols;
        private final double[] cumulative;

        Table(Acid[] acids) {
            symbols = new byte[acids.length];
            cumulative = new double[acids.length];
            double sum = 0.0;

            for (int i = 0; i < acids.length; i++) {
                sum += acids[i].probability();
                symbols[i] = (byte) acids[i].symbol();
                cumulative[i] = sum;
            }
        }

        /** The first symbol whose cumulative probability exceeds r, else the last one. */
        byte pick(double r) {
            for (int i = 0; i < cumulative.length; i++) {
                if (r < cumulative[i]) {
                    return symbols[i];
                }
            }

            return symbols[symbols.length - 1];
        }
    }

    /** The generator shared by records TWO and THREE. */
    static final class Generator {
        private int seed = INITIAL_SEED;

        /** Advances the generator and returns seed / IM in [0, 1). */
        double next() {
            seed = (seed * IA + IC) % IM; // below 2^30: no int overflow
            return (double) seed / IM;
        }
    }

    private Main() {
    }

    public static void main(String[] args) {
        var n = parseCount(args);

        if (n.isEmpty()) {
            System.err.println(USAGE);
            System.exit(1);
        }

        try (var out = new BufferedOutputStream(new FileOutputStream(FileDescriptor.out), BUFFER_SIZE)) {
            writeFasta(out, n.getAsInt());
        } catch (IOException e) {
            System.err.println("fasta: " + e.getMessage());
            System.exit(1);
        }
    }

    /** Accepts exactly one argument made only of ASCII digits (Integer.parseInt alone accepts '+'). */
    static OptionalInt parseCount(String[] args) {
        if (args.length != 1 || !isDigits(args[0])) {
            return OptionalInt.empty();
        }

        try {
            int n = Integer.parseInt(args[0]);
            return n <= MAX_COUNT ? OptionalInt.of(n) : OptionalInt.empty();
        } catch (NumberFormatException e) {
            return OptionalInt.empty(); // more digits than an int can hold
        }
    }

    private static boolean isDigits(String text) {
        return !text.isEmpty() && text.chars().allMatch(c -> c >= '0' && c <= '9');
    }

    /** Writes the three records; one generator serves both random ones. */
    static void writeFasta(OutputStream out, int n) throws IOException {
        var generator = new Generator();

        writeAscii(out, ">ONE Homo sapiens alu\n");
        writeRepeat(out, ALU, 2 * n);
        writeAscii(out, ">TWO IUB ambiguity codes\n");
        writeRandom(out, generator, new Table(IUB), 3 * n);
        writeAscii(out, ">THREE Homo sapiens frequency\n");
        writeRandom(out, generator, new Table(HOMO_SAPIENS), 5 * n);
    }

    private static void writeAscii(OutputStream out, String text) throws IOException {
        out.write(text.getBytes(StandardCharsets.US_ASCII));
    }

    /** Writes n characters of s repeated cyclically, LINE_WIDTH per line. */
    static void writeRepeat(OutputStream out, String s, int n) throws IOException {
        // A line starting anywhere in s never wraps inside s + s[0..LINE_WIDTH).
        var extended = (s + s.substring(0, LINE_WIDTH)).getBytes(StandardCharsets.US_ASCII);
        int pos = 0;

        for (int left = n; left > 0; left -= LINE_WIDTH) {
            int count = Math.min(LINE_WIDTH, left);
            out.write(extended, pos, count);
            out.write('\n');
            pos = (pos + count) % s.length();
        }
    }

    /** Writes n symbols picked from table, one generator step each, LINE_WIDTH per line. */
    static void writeRandom(OutputStream out, Generator generator, Table table, int n) throws IOException {
        var line = new byte[LINE_WIDTH + 1];

        for (int left = n; left > 0; left -= LINE_WIDTH) {
            int count = Math.min(LINE_WIDTH, left);

            for (int i = 0; i < count; i++) {
                line[i] = table.pick(generator.next());
            }

            line[count] = '\n';
            out.write(line, 0, count + 1);
        }
    }
}
