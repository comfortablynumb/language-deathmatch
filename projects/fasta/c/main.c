// Fasta: generate three DNA sequences in FASTA format (Benchmarks Game, sequential).

#include <errno.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

constexpr size_t max_count = 25'000'000;
constexpr size_t line_width = 60;
constexpr size_t max_acids = 15;
constexpr size_t output_buffer_size = 64 * 1024;
static const char usage[] = "usage: fasta N  (N: 0..25000000)\n";

// Linear congruential generator: seed = (seed * ia + ic) % im.
constexpr uint32_t im = 139'968;
constexpr uint32_t ia = 3'877;
constexpr uint32_t ic = 29'573;
constexpr uint32_t initial_seed = 42;

static const char alu[] =
    "GGCCGGGCGCGGTGGCTCACGCCTGTAATCCCAGCACTTTGG"
    "GAGGCCGAGGCGGGCGGATCACCTGAGGTCAGGAGTTCGAGA"
    "CCAGCCTGGCCAACATGGTGAAACCCCGTCTCTACTAAAAAT"
    "ACAAAAATTAGCCGGGCGTGGTGGCGCGCGCCTGTAATCCCA"
    "GCTACTCGGGAGGCTGAGGCAGGAGAATCGCTTGAACCCGGG"
    "AGGCGGAGGTTGCAGTGAGCCGAGATCGCGCCACTGCACTCC"
    "AGCCTGGGCGACAGAGCGAGACTCCGTCTCAAAAA";

// One symbol of a frequency table with its probability.
struct acid {
    char symbol;
    double probability;
};

static const struct acid iub[] = {
    {'a', 0.27}, {'c', 0.12}, {'g', 0.12}, {'t', 0.27},
    {'B', 0.02}, {'D', 0.02}, {'H', 0.02}, {'K', 0.02}, {'M', 0.02},
    {'N', 0.02}, {'R', 0.02}, {'S', 0.02}, {'V', 0.02}, {'W', 0.02}, {'Y', 0.02},
};

static const struct acid homo_sapiens[] = {
    {'a', 0.3029549426680},
    {'c', 0.1979883004921},
    {'g', 0.1975473066391},
    {'t', 0.3015094502008},
};

// Number of elements of an array (not of a pointer).
#define ARRAY_LENGTH(array) (sizeof(array) / sizeof((array)[0]))

static_assert(ARRAY_LENGTH(iub) <= max_acids && ARRAY_LENGTH(homo_sapiens) <= max_acids);

// Symbols with their cumulative probabilities, in table order.
struct table {
    size_t size;
    char symbols[max_acids];
    double cumulative[max_acids];
};

// The generator shared by records TWO and THREE.
struct generator {
    uint32_t seed;
};

// The smaller of a and b.
static size_t min_size(size_t a, size_t b) {
    return a < b ? a : b;
}

// True when text is non-empty and made only of ASCII digits (strtoull alone accepts signs and spaces).
static bool is_digits(const char *text) {
    if (*text == '\0') {
        return false;
    }

    for (const char *c = text; *c != '\0'; ++c) {
        if (*c < '0' || *c > '9') {
            return false;
        }
    }

    return true;
}

// Accepts exactly one argument made only of ASCII digits, at most max_count.
static bool parse_count(int argc, char *argv[], size_t *count) {
    if (argc != 2 || !is_digits(argv[1])) {
        return false;
    }

    errno = 0;
    const unsigned long long value = strtoull(argv[1], nullptr, 10);

    if (errno == ERANGE || value > max_count) {
        return false;
    }

    *count = (size_t)value;
    return true;
}

// Builds the running double sums of the probabilities (c0 = 0.0 + p0, ci = ci-1 + pi).
static struct table make_table(const struct acid acids[], size_t size) {
    struct table table = {.size = size};
    double sum = 0.0;

    for (size_t i = 0; i < size; ++i) {
        sum += acids[i].probability;
        table.symbols[i] = acids[i].symbol;
        table.cumulative[i] = sum;
    }

    return table;
}

// The first symbol whose cumulative probability exceeds r, else the last one.
static char pick(const struct table *table, double r) {
    for (size_t i = 0; i < table->size; ++i) {
        if (r < table->cumulative[i]) {
            return table->symbols[i];
        }
    }

    return table->symbols[table->size - 1];
}

// Advances the generator and returns seed / im in [0, 1).
static double next_random(struct generator *rng) {
    rng->seed = (rng->seed * ia + ic) % im;  // below 2^30: no overflow
    return (double)rng->seed / im;
}

// Writes n characters of s repeated cyclically, line_width per line (s is longer than a line).
static void write_repeat(FILE *out, const char *s, size_t n) {
    const size_t size = strlen(s);
    size_t pos = 0;

    for (size_t left = n; left > 0;) {
        const size_t count = min_size(left, line_width);
        const size_t head = min_size(count, size - pos);  // up to the end of s
        fwrite(s + pos, 1, head, out);
        fwrite(s, 1, count - head, out);  // the rest of the line wraps to the start of s
        putc('\n', out);
        pos = (pos + count) % size;
        left -= count;
    }
}

// Writes n symbols picked from table, one generator step each, line_width per line.
static void write_random(FILE *out, struct generator *rng, const struct table *table, size_t n) {
    char line[line_width + 1];

    for (size_t left = n; left > 0;) {
        const size_t count = min_size(left, line_width);

        for (size_t i = 0; i < count; ++i) {
            line[i] = pick(table, next_random(rng));
        }

        line[count] = '\n';
        fwrite(line, 1, count + 1, out);
        left -= count;
    }
}

// Writes the three records; one generator serves both random ones.
static void write_fasta(FILE *out, size_t n) {
    const struct table iub_table = make_table(iub, ARRAY_LENGTH(iub));
    const struct table homo_sapiens_table = make_table(homo_sapiens, ARRAY_LENGTH(homo_sapiens));
    struct generator rng = {.seed = initial_seed};

    fputs(">ONE Homo sapiens alu\n", out);
    write_repeat(out, alu, 2 * n);
    fputs(">TWO IUB ambiguity codes\n", out);
    write_random(out, &rng, &iub_table, 3 * n);
    fputs(">THREE Homo sapiens frequency\n", out);
    write_random(out, &rng, &homo_sapiens_table, 5 * n);
}

int main(int argc, char *argv[]) {
    static char output_buffer[output_buffer_size];
    size_t n = 0;

    if (!parse_count(argc, argv, &n)) {
        fputs(usage, stderr);
        return 1;
    }

    setvbuf(stdout, output_buffer, _IOFBF, sizeof output_buffer);
    write_fasta(stdout, n);

    if (fflush(stdout) != 0 || ferror(stdout)) {
        perror("fasta: write");
        return 1;
    }

    return 0;
}
