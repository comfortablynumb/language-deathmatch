// Primes sieve: count, sum and find the largest prime up to N with the Sieve of Eratosthenes.

#include <algorithm>
#include <charconv>
#include <cstddef>
#include <cstdint>
#include <iostream>
#include <optional>
#include <ostream>
#include <span>
#include <string_view>
#include <vector>

namespace {

constexpr std::size_t max_limit = 200'000'000;
constexpr std::string_view usage = "usage: primes-sieve N  (N: 0..200000000)\n";

// The result of scanning the sieve.
struct Summary {
    std::uint64_t count = 0;
    std::uint64_t sum = 0;
    std::uint64_t largest = 0;
};

// Accepts exactly one argument made only of ASCII digits.
std::optional<std::size_t> parse_limit(std::span<char*> args) {
    if (args.size() != 1) {
        return std::nullopt;
    }

    const std::string_view text{args[0]};
    const bool all_digits = !text.empty()
        && std::ranges::all_of(text, [](char c) { return c >= '0' && c <= '9'; });

    if (!all_digits) {
        return std::nullopt;
    }

    std::size_t n = 0;
    const auto [end, error] = std::from_chars(text.data(), text.data() + text.size(), n);

    if (error != std::errc{} || end != text.data() + text.size() || n > max_limit) {
        return std::nullopt;
    }

    return n;
}

// Returns one byte per integer 0..n (std::vector<bool> would pack bits); 1 = prime.
std::vector<std::uint8_t> sieve(std::size_t n) {
    std::vector<std::uint8_t> is_prime(n + 1, 1);
    std::fill_n(is_prime.begin(), std::min<std::size_t>(2, is_prime.size()), 0);  // 0 and 1

    for (std::size_t p = 2; p * p <= n; ++p) {
        if (!is_prime[p]) {
            continue;
        }

        for (std::size_t multiple = p * p; multiple <= n; multiple += p) {
            is_prime[multiple] = 0;
        }
    }

    return is_prime;
}

// Counts and sums the primes and finds the largest one (0 when there is none).
Summary summarize(const std::vector<std::uint8_t>& is_prime) {
    Summary summary;

    for (std::size_t i = 0; i < is_prime.size(); ++i) {
        if (is_prime[i]) {
            ++summary.count;
            summary.sum += i;
            summary.largest = i;
        }
    }

    return summary;
}

// Writes the three result lines and flushes.
void write_summary(std::ostream& out, const Summary& summary) {
    out << "count: " << summary.count << '\n'
        << "sum: " << summary.sum << '\n'
        << "largest: " << summary.largest << '\n';
    out.flush();
}

}  // namespace

int main(int argc, char* argv[]) {
    const auto n = parse_limit(std::span<char*>(argv + 1, static_cast<std::size_t>(argc - 1)));

    if (!n) {
        std::cerr << usage;
        return 1;
    }

    std::ios::sync_with_stdio(false);
    write_summary(std::cout, summarize(sieve(*n)));

    return std::cout ? 0 : 1;
}
