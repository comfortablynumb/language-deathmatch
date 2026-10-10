// Primes sieve: count, sum and find the largest prime up to N with the Sieve of Eratosthenes.

#include <errno.h>
#include <inttypes.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

constexpr size_t max_limit = 200'000'000;
constexpr size_t output_buffer_size = 64 * 1024;
static const char usage[] = "usage: primes-sieve N  (N: 0..200000000)\n";

// The result of scanning the sieve.
struct summary {
    uint64_t count;
    uint64_t sum;
    uint64_t largest;
};

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

// Accepts exactly one argument made only of ASCII digits, at most max_limit.
static bool parse_limit(int argc, char *argv[], size_t *limit) {
    if (argc != 2 || !is_digits(argv[1])) {
        return false;
    }

    errno = 0;
    const unsigned long long value = strtoull(argv[1], nullptr, 10);

    if (errno == ERANGE || value > max_limit) {
        return false;
    }

    *limit = (size_t)value;
    return true;
}

// Returns n + 1 malloc'd flags, one unsigned char per integer 0..n (1 = prime), or nullptr.
static unsigned char *sieve(size_t n) {
    unsigned char *is_prime = malloc(n + 1);

    if (is_prime == nullptr) {
        return nullptr;
    }

    memset(is_prime, 1, n + 1);
    is_prime[0] = 0;

    if (n >= 1) {
        is_prime[1] = 0;
    }

    for (size_t p = 2; p * p <= n; ++p) {
        if (!is_prime[p]) {
            continue;
        }

        for (size_t multiple = p * p; multiple <= n; multiple += p) {
            is_prime[multiple] = 0;
        }
    }

    return is_prime;
}

// Counts and sums the primes in flags[0..n] and finds the largest one (0 when there is none).
static struct summary summarize(const unsigned char *is_prime, size_t n) {
    struct summary summary = {};

    for (size_t i = 0; i <= n; ++i) {
        if (is_prime[i]) {
            ++summary.count;
            summary.sum += i;
            summary.largest = i;
        }
    }

    return summary;
}

// Writes the three result lines.
static void write_summary(FILE *out, struct summary summary) {
    fprintf(out, "count: %" PRIu64 "\n", summary.count);
    fprintf(out, "sum: %" PRIu64 "\n", summary.sum);
    fprintf(out, "largest: %" PRIu64 "\n", summary.largest);
}

int main(int argc, char *argv[]) {
    static char output_buffer[output_buffer_size];
    size_t n = 0;

    if (!parse_limit(argc, argv, &n)) {
        fputs(usage, stderr);
        return 1;
    }

    unsigned char *is_prime = sieve(n);

    if (is_prime == nullptr) {
        fputs("primes-sieve: out of memory\n", stderr);
        return 1;
    }

    setvbuf(stdout, output_buffer, _IOFBF, sizeof output_buffer);
    write_summary(stdout, summarize(is_prime, n));
    free(is_prime);

    if (fflush(stdout) != 0 || ferror(stdout)) {
        perror("primes-sieve: write");
        return 1;
    }

    return 0;
}
