// Binary trees: allocate, walk and discard perfect binary trees (Benchmarks Game, sequential).

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>

constexpr int min_depth = 4;
constexpr unsigned long long max_input = 21;
constexpr size_t output_buffer_size = 64 * 1024;
static const char usage[] = "usage: binary-trees N  (N: 0..21)\n";

// One heap-allocated tree node; a leaf has null children.
struct node {
    struct node *left;
    struct node *right;
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

// Accepts exactly one argument made only of ASCII digits, at most max_input.
static bool parse_depth(int argc, char *argv[], int *depth) {
    if (argc != 2 || !is_digits(argv[1])) {
        return false;
    }

    errno = 0;
    const unsigned long long value = strtoull(argv[1], nullptr, 10);

    if (errno == ERANGE || value > max_input) {
        return false;
    }

    *depth = (int)value;
    return true;
}

// Allocates one node with malloc; running out of memory ends the program.
static struct node *new_node(struct node *left, struct node *right) {
    struct node *node = malloc(sizeof *node);

    if (node == nullptr) {
        fputs("binary-trees: out of memory\n", stderr);
        exit(1);
    }

    *node = (struct node){.left = left, .right = right};
    return node;
}

// Allocates a perfect tree of the given depth, children before their parent.
static struct node *bottom_up_tree(int depth) {
    if (depth == 0) {
        return new_node(nullptr, nullptr);
    }

    struct node *left = bottom_up_tree(depth - 1);
    struct node *right = bottom_up_tree(depth - 1);
    return new_node(left, right);
}

// Walks the whole tree and returns its node count.
static int check(const struct node *node) {
    if (node->left == nullptr) {
        return 1;
    }

    return 1 + check(node->left) + check(node->right);
}

// Frees every node of the tree, children before their parent: one free per node.
static void free_tree(struct node *node) {
    if (node->left != nullptr) {
        free_tree(node->left);
        free_tree(node->right);
    }

    free(node);
}

// Builds, checks and frees one tree of the given depth.
static int build_check_free(int depth) {
    struct node *tree = bottom_up_tree(depth);
    const int count = check(tree);
    free_tree(tree);
    return count;
}

// Builds, checks and frees `iterations` trees of `depth`, one at a time.
static int sum_checks(int depth, int iterations) {
    int sum = 0;

    for (int i = 0; i < iterations; ++i) {
        sum += build_check_free(depth);
    }

    return sum;
}

// Prints the stretch tree, one line per iteration depth and the long-lived tree.
static void run(FILE *out, int n) {
    const int max_depth = n > min_depth + 2 ? n : min_depth + 2;
    const int stretch_depth = max_depth + 1;

    fprintf(out, "stretch tree of depth %d\t check: %d\n", stretch_depth,
            build_check_free(stretch_depth));

    struct node *long_lived = bottom_up_tree(max_depth);

    for (int depth = min_depth; depth <= max_depth; depth += 2) {
        const int iterations = 1 << (max_depth - depth + min_depth);
        fprintf(out, "%d\t trees of depth %d\t check: %d\n", iterations, depth,
                sum_checks(depth, iterations));
    }

    fprintf(out, "long lived tree of depth %d\t check: %d\n", max_depth, check(long_lived));
    free_tree(long_lived);
}

int main(int argc, char *argv[]) {
    static char output_buffer[output_buffer_size];
    int n = 0;

    if (!parse_depth(argc, argv, &n)) {
        fputs(usage, stderr);
        return 1;
    }

    setvbuf(stdout, output_buffer, _IOFBF, sizeof output_buffer);
    run(stdout, n);

    if (fflush(stdout) != 0 || ferror(stdout)) {
        perror("binary-trees: write");
        return 1;
    }

    return 0;
}
