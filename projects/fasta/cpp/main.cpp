// Fasta: generate three DNA sequences in FASTA format (Benchmarks Game, sequential).

#include <algorithm>
#include <array>
#include <charconv>
#include <cstddef>
#include <cstdint>
#include <iostream>
#include <optional>
#include <ostream>
#include <span>
#include <string>
#include <string_view>
#include <vector>

namespace {

constexpr std::size_t max_count = 25'000'000;
constexpr std::size_t line_width = 60;
constexpr std::string_view usage = "usage: fasta N  (N: 0..25000000)\n";

// Linear congruential generator: seed = (seed * ia + ic) % im.
constexpr std::uint32_t im = 139'968;
constexpr std::uint32_t ia = 3'877;
constexpr std::uint32_t ic = 29'573;
constexpr std::uint32_t initial_seed = 42;

constexpr std::string_view alu =
    "GGCCGGGCGCGGTGGCTCACGCCTGTAATCCCAGCACTTTGG"
    "GAGGCCGAGGCGGGCGGATCACCTGAGGTCAGGAGTTCGAGA"
    "CCAGCCTGGCCAACATGGTGAAACCCCGTCTCTACTAAAAAT"
    "ACAAAAATTAGCCGGGCGTGGTGGCGCGCGCCTGTAATCCCA"
    "GCTACTCGGGAGGCTGAGGCAGGAGAATCGCTTGAACCCGGG"
    "AGGCGGAGGTTGCAGTGAGCCGAGATCGCGCCACTGCACTCC"
    "AGCCTGGGCGACAGAGCGAGACTCCGTCTCAAAAA";

struct Acid {
    char symbol;
    double probability;
};

constexpr std::array<Acid, 15> iub{{
    {'a', 0.27}, {'c', 0.12}, {'g', 0.12}, {'t', 0.27},
    {'B', 0.02}, {'D', 0.02}, {'H', 0.02}, {'K', 0.02}, {'M', 0.02},
    {'N', 0.02}, {'R', 0.02}, {'S', 0.02}, {'V', 0.02}, {'W', 0.02}, {'Y', 0.02},
}};

constexpr std::array<Acid, 4> homo_sapiens{{
    {'a', 0.3029549426680},
    {'c', 0.1979883004921},
    {'g', 0.1975473066391},
    {'t', 0.3015094502008},
}};

// Symbols with their cumulative probabilities, in table order.
class Table {
public:
    explicit Table(std::span<const Acid> acids) {
        double sum = 0.0;

        for (const Acid& acid : acids) {
            sum += acid.probability;
            symbols_.push_back(acid.symbol);
            cumulative_.push_back(sum);
        }
    }

    // The first symbol whose cumulative probability exceeds r, else the last one.
    char pick(double r) const {
        const auto it = std::ranges::find_if(cumulative_, [r](double c) { return r < c; });

        if (it == cumulative_.end()) {
            return symbols_.back();
        }

        return symbols_[static_cast<std::size_t>(it - cumulative_.begin())];
    }

private:
    std::vector<char> symbols_;
    std::vector<double> cumulative_;
};

// The generator shared by records TWO and THREE.
class Random {
public:
    // Advances the generator and returns seed / im in [0, 1).
    double next() {
        seed_ = (seed_ * ia + ic) % im;  // below 2^30: no overflow
        return static_cast<double>(seed_) / im;
    }

private:
    std::uint32_t seed_ = initial_seed;
};

// Accepts exactly one argument made only of ASCII digits.
std::optional<std::size_t> parse_count(std::span<char*> args) {
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

    if (error != std::errc{} || end != text.data() + text.size() || n > max_count) {
        return std::nullopt;
    }

    return n;
}

// Writes n characters of s repeated cyclically, line_width per line.
void write_repeat(std::ostream& out, std::string_view s, std::size_t n) {
    const std::string extended = std::string{s} + std::string{s.substr(0, line_width)};
    std::size_t pos = 0;

    for (std::size_t left = n; left > 0;) {
        const std::size_t count = std::min(left, line_width);
        out.write(extended.data() + pos, static_cast<std::streamsize>(count)) << '\n';
        pos = (pos + count) % s.size();
        left -= count;
    }
}

// Writes n symbols picked from table, one generator step each, line_width per line.
void write_random(std::ostream& out, Random& random, const Table& table, std::size_t n) {
    std::array<char, line_width + 1> line{};

    for (std::size_t left = n; left > 0;) {
        const std::size_t count = std::min(left, line_width);

        for (std::size_t i = 0; i < count; ++i) {
            line[i] = table.pick(random.next());
        }

        line[count] = '\n';
        out.write(line.data(), static_cast<std::streamsize>(count + 1));
        left -= count;
    }
}

// Writes the three records; one generator serves both random ones.
void write_fasta(std::ostream& out, std::size_t n) {
    Random random;

    out << ">ONE Homo sapiens alu\n";
    write_repeat(out, alu, 2 * n);
    out << ">TWO IUB ambiguity codes\n";
    write_random(out, random, Table{iub}, 3 * n);
    out << ">THREE Homo sapiens frequency\n";
    write_random(out, random, Table{homo_sapiens}, 5 * n);
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
    write_fasta(std::cout, *n);

    return std::cout ? 0 : 1;
}
