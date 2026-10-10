// Mandelbrot: render the Mandelbrot set as an N×N binary PBM (P4) bitmap.

#include <errno.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

constexpr unsigned long long max_size = 16'000;
constexpr size_t max_row_bytes = (max_size + 7) / 8;
constexpr int max_iterations = 50;
constexpr double limit = 4.0;
constexpr size_t output_buffer_size = 64 * 1024;
static const char usage[] = "usage: mandelbrot N  (N: 1..16000)\n";

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

// Accepts exactly one argument made only of ASCII digits, 1..max_size.
static bool parse_size(int argc, char *argv[], int *size) {
    if (argc != 2 || !is_digits(argv[1])) {
        return false;
    }

    errno = 0;
    const unsigned long long value = strtoull(argv[1], nullptr, 10);

    if (errno == ERANGE || value < 1 || value > max_size) {
        return false;
    }

    *size = (int)value;
    return true;
}

// Bytes per bitmap row: ceil(n / 8).
static size_t row_bytes(int n) {
    return (size_t)(n + 7) / 8;
}

// Iterates z = z² + c up to max_iterations times; true if |z|² stayed ≤ 4.
// Built with -ffp-contract=off, so a * b + c is never fused into an FMA.
static bool in_set(double cr, double ci) {
    double zr = 0.0;
    double zi = 0.0;
    double tr = 0.0;
    double ti = 0.0;

    for (int i = 0; i < max_iterations && tr + ti <= limit; ++i) {
        zi = 2.0 * zr * zi + ci;
        zr = tr - ti + cr;
        tr = zr * zr;
        ti = zi * zi;
    }

    return tr + ti <= limit;
}

// Packs the n pixels of row y into row, 8 per byte, most significant bit first.
static void render_row(unsigned char *row, int y, int n) {
    const double size = (double)n;
    const double ci = 2.0 * y / size - 1.0;
    memset(row, 0, row_bytes(n));

    for (int x = 0; x < n; ++x) {
        const double cr = 2.0 * x / size - 1.5;

        if (in_set(cr, ci)) {
            row[x / 8] |= (unsigned char)(0x80 >> (x % 8));
        }
    }
}

// Writes the PBM header, then the n rows of the bitmap from top to bottom.
static void write_image(FILE *out, int n) {
    unsigned char row[max_row_bytes];

    fprintf(out, "P4\n%d %d\n", n, n);

    for (int y = 0; y < n; ++y) {
        render_row(row, y, n);
        fwrite(row, 1, row_bytes(n), out);
    }
}

int main(int argc, char *argv[]) {
    static char output_buffer[output_buffer_size];
    int n = 0;

    if (!parse_size(argc, argv, &n)) {
        fputs(usage, stderr);
        return 1;
    }

    setvbuf(stdout, output_buffer, _IOFBF, sizeof output_buffer);
    write_image(stdout, n);

    if (fflush(stdout) != 0 || ferror(stdout)) {
        perror("mandelbrot: write");
        return 1;
    }

    return 0;
}
