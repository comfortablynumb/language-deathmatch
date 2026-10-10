// Primes sieve: count, sum and find the largest prime up to N with the Sieve of Eratosthenes.

import java.io.BufferedOutputStream;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.OptionalInt;

public final class Main {
    private static final int MAX_LIMIT = 200_000_000;
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final String USAGE = "usage: primes-sieve N  (N: 0..200000000)";

    /** The result of scanning the sieve. */
    record Summary(long count, long sum, long largest) {
    }

    private Main() {
    }

    public static void main(String[] args) {
        var n = parseLimit(args);

        if (n.isEmpty()) {
            System.err.println(USAGE);
            System.exit(1);
        }

        try (var out = new BufferedOutputStream(new FileOutputStream(FileDescriptor.out), BUFFER_SIZE)) {
            writeSummary(out, summarize(sieve(n.getAsInt())));
        } catch (IOException e) {
            System.err.println("primes-sieve: " + e.getMessage());
            System.exit(1);
        }
    }

    /** Accepts exactly one argument made only of ASCII digits (Integer.parseInt alone accepts '+'). */
    static OptionalInt parseLimit(String[] args) {
        if (args.length != 1 || !isDigits(args[0])) {
            return OptionalInt.empty();
        }

        try {
            int n = Integer.parseInt(args[0]);
            return n <= MAX_LIMIT ? OptionalInt.of(n) : OptionalInt.empty();
        } catch (NumberFormatException e) {
            return OptionalInt.empty(); // more digits than an int can hold
        }
    }

    private static boolean isDigits(String text) {
        return !text.isEmpty() && text.chars().allMatch(c -> c >= '0' && c <= '9');
    }

    /** Returns one flag per integer 0..n (a boolean is one byte in HotSpot arrays); true = prime. */
    static boolean[] sieve(int n) {
        var isPrime = new boolean[n + 1]; // all false: 0 and 1 are not prime

        if (n >= 2) {
            Arrays.fill(isPrime, 2, n + 1, true);
        }

        // Java arrays have int indices: p * p and multiple + p stay below 2^31 for n <= MAX_LIMIT.
        for (int p = 2; p * p <= n; p++) {
            if (!isPrime[p]) {
                continue;
            }

            for (int multiple = p * p; multiple <= n; multiple += p) {
                isPrime[multiple] = false;
            }
        }

        return isPrime;
    }

    /** Counts and sums the primes and finds the largest one (0 when there is none). */
    static Summary summarize(boolean[] isPrime) {
        long count = 0;
        long sum = 0;
        long largest = 0;

        for (int i = 0; i < isPrime.length; i++) {
            if (isPrime[i]) {
                count++;
                sum += i;
                largest = i;
            }
        }

        return new Summary(count, sum, largest);
    }

    /** Writes the three result lines as ASCII bytes. */
    static void writeSummary(OutputStream out, Summary summary) throws IOException {
        var text = "count: " + summary.count() + "\n"
                + "sum: " + summary.sum() + "\n"
                + "largest: " + summary.largest() + "\n";
        out.write(text.getBytes(StandardCharsets.US_ASCII));
    }
}
