// Fibonacci: print the first N Fibonacci numbers (mod 2^64), one per line.

#include <errno.h>
#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

constexpr uint64_t max_count = 1'000'000'000;
constexpr size_t output_buffer_size = 64 * 1024;
static const char usage[] = "usage: fibonacci N  (N: 0..1000000000)\n";

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
static bool parse_count(int argc, char *argv[], uint64_t *count) {
    if (argc != 2 || !is_digits(argv[1])) {
        return false;
    }

    errno = 0;
    const unsigned long long value = strtoull(argv[1], nullptr, 10);

    if (errno == ERANGE || value > max_count) {
        return false;
    }

    *count = value;
    return true;
}

// Writes F(0)..F(n-1); unsigned overflow wraps modulo 2^64 by definition.
static void write_fibonacci(FILE *out, uint64_t n) {
    uint64_t a = 0;
    uint64_t b = 1;

    for (uint64_t i = 0; i < n; ++i) {
        fprintf(out, "%" PRIu64 "\n", a);

        const uint64_t next = a + b;
        a = b;
        b = next;
    }
}

int main(int argc, char *argv[]) {
    static char output_buffer[output_buffer_size];
    uint64_t n = 0;

    if (!parse_count(argc, argv, &n)) {
        fputs(usage, stderr);
        return 1;
    }

    setvbuf(stdout, output_buffer, _IOFBF, sizeof output_buffer);
    write_fibonacci(stdout, n);

    if (fflush(stdout) != 0 || ferror(stdout)) {
        perror("fibonacci: write");
        return 1;
    }

    return 0;
}
