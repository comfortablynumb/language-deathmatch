// Binary trees: allocate, walk and discard perfect binary trees (Benchmarks Game, sequential).

#include <algorithm>
#include <charconv>
#include <iostream>
#include <memory>
#include <optional>
#include <ostream>
#include <span>
#include <string_view>
#include <utility>

namespace {

constexpr int min_depth = 4;
constexpr int max_input = 21;
constexpr std::string_view usage = "usage: binary-trees N  (N: 0..21)\n";

// One heap-allocated tree node; a leaf has null children.
struct Node {
    std::unique_ptr<Node> left;
    std::unique_ptr<Node> right;
};

// Accepts exactly one argument made only of ASCII digits.
std::optional<int> parse_depth(std::span<char*> args) {
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

    if (error != std::errc{} || end != text.data() + text.size() || n > max_input) {
        return std::nullopt;
    }

    return n;
}

// Allocates a perfect tree of the given depth, children before their parent.
std::unique_ptr<Node> bottom_up_tree(int depth) {
    if (depth == 0) {
        return std::make_unique<Node>();
    }

    auto left = bottom_up_tree(depth - 1);
    auto right = bottom_up_tree(depth - 1);
    return std::make_unique<Node>(std::move(left), std::move(right));
}

// Walks the whole tree and returns its node count.
int check(const Node& node) {
    if (!node.left) {
        return 1;
    }

    return 1 + check(*node.left) + check(*node.right);
}

// Builds, checks and drops `iterations` trees of `depth`, one at a time.
int sum_checks(int depth, int iterations) {
    int sum = 0;

    for (int i = 0; i < iterations; ++i) {
        sum += check(*bottom_up_tree(depth));
    }

    return sum;
}

// Prints the stretch tree, one line per iteration depth and the long-lived tree.
void run(std::ostream& out, int n) {
    const int max_depth = std::max(min_depth + 2, n);
    const int stretch_depth = max_depth + 1;

    out << "stretch tree of depth " << stretch_depth
        << "\t check: " << check(*bottom_up_tree(stretch_depth)) << '\n';

    const auto long_lived = bottom_up_tree(max_depth);

    for (int depth = min_depth; depth <= max_depth; depth += 2) {
        const int iterations = 1 << (max_depth - depth + min_depth);
        out << iterations << "\t trees of depth " << depth
            << "\t check: " << sum_checks(depth, iterations) << '\n';
    }

    out << "long lived tree of depth " << max_depth << "\t check: " << check(*long_lived) << '\n';
    out.flush();
}

}  // namespace

int main(int argc, char* argv[]) {
    const auto n = parse_depth(std::span<char*>(argv + 1, static_cast<std::size_t>(argc - 1)));

    if (!n) {
        std::cerr << usage;
        return 1;
    }

    std::ios::sync_with_stdio(false);
    run(std::cout, *n);

    return std::cout ? 0 : 1;
}
