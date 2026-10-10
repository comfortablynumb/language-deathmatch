// Mandelbrot: render the Mandelbrot set as an N×N binary PBM (P4) bitmap.

#include <algorithm>
#include <charconv>
#include <cstddef>
#include <ios>
#include <iostream>
#include <optional>
#include <ostream>
#include <span>
#include <string_view>
#include <vector>

namespace {

constexpr int max_size = 16'000;
constexpr int max_iterations = 50;
constexpr double limit = 4.0;
constexpr std::string_view usage = "usage: mandelbrot N  (N: 1..16000)\n";

// Accepts exactly one argument made only of ASCII digits, 1..max_size.
std::optional<int> parse_size(std::span<char*> args) {
    if (args.size() != 1) {
        return std::nullopt;
    }

    const std::string_view text{args[0]};
    const bool all_digits = !text.empty()
        && std::ranges::all_of(text, [](char c) { return c >= '0' && c <= '9'; });

    if (!all_digits) {
        return std::nullopt;
    }

    int n = 0;
    const auto [end, error] = std::from_chars(text.data(), text.data() + text.size(), n);

    if (error != std::errc{} || end != text.data() + text.size() || n < 1 || n > max_size) {
        return std::nullopt;
    }

    return n;
}

// Iterates z = z² + c up to max_iterations times; true if |z|² stayed ≤ 4.
// Built with -ffp-contract=off, so a * b + c is never fused into an FMA.
bool in_set(double cr, double ci) {
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
void render_row(std::span<unsigned char> row, int y, int n) {
    const auto size = static_cast<double>(n);
    const double ci = 2.0 * y / size - 1.0;
    std::ranges::fill(row, 0);

    for (int x = 0; x < n; ++x) {
        const double cr = 2.0 * x / size - 1.5;

        if (in_set(cr, ci)) {
            row[static_cast<std::size_t>(x / 8)] |= static_cast<unsigned char>(0x80 >> (x % 8));
        }
    }
}

// Writes the PBM header, then the n rows of the bitmap from top to bottom.
void write_image(std::ostream& out, int n) {
    out << "P4\n" << n << ' ' << n << '\n';
    std::vector<unsigned char> row(static_cast<std::size_t>((n + 7) / 8));

    for (int y = 0; y < n; ++y) {
        render_row(row, y, n);
        out.write(reinterpret_cast<const char*>(row.data()), static_cast<std::streamsize>(row.size()));
    }

    out.flush();
}

}  // namespace

int main(int argc, char* argv[]) {
    const auto n = parse_size(std::span<char*>(argv + 1, static_cast<std::size_t>(argc - 1)));

    if (!n) {
        std::cerr << usage;
        return 1;
    }

    std::ios::sync_with_stdio(false);
    write_image(std::cout, *n);

    return std::cout ? 0 : 1;
}
