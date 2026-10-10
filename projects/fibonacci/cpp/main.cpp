// Fibonacci: print the first N Fibonacci numbers (mod 2^64), one per line.

#include <algorithm>
#include <charconv>
#include <cstdint>
#include <iostream>
#include <optional>
#include <ostream>
#include <span>
#include <string_view>

namespace {

constexpr std::uint64_t max_count = 1'000'000'000;
constexpr std::string_view usage = "usage: fibonacci N  (N: 0..1000000000)\n";

// Accepts exactly one argument made only of ASCII digits.
std::optional<std::uint64_t> parse_count(std::span<char*> args) {
    if (args.size() != 1) {
        return std::nullopt;
    }

    const std::string_view text{args[0]};
    const bool all_digits = !text.empty()
        && std::ranges::all_of(text, [](char c) { return c >= '0' && c <= '9'; });

    if (!all_digits) {
        return std::nullopt;
    }

    std::uint64_t n = 0;
    const auto [end, error] = std::from_chars(text.data(), text.data() + text.size(), n);

    if (error != std::errc{} || end != text.data() + text.size() || n > max_count) {
        return std::nullopt;
    }

    return n;
}

// Writes F(0)..F(n-1); unsigned overflow wraps modulo 2^64 by definition.
void write_fibonacci(std::ostream& out, std::uint64_t n) {
    std::uint64_t a = 0;
    std::uint64_t b = 1;

    for (std::uint64_t i = 0; i < n; ++i) {
        out << a << '\n';

        const std::uint64_t next = a + b;
        a = b;
        b = next;
    }

    out.flush();
}

}  // namespace

int main(int argc, char* argv[]) {
    const auto n = parse_count(std::span<char*>(argv + 1, static_cast<std::size_t>(argc - 1)));

    if (!n) {
        std::cerr << usage;
        return 1;
    }

    std::ios::sync_with_stdio(false);
    write_fibonacci(std::cout, *n);

    return std::cout ? 0 : 1;
}
