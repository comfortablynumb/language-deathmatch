# Binary Trees

| Field | Value |
|-------|-------|
| Id | `binary-trees` |
| Category | Data Structures & Memory (`data-structures`) |
| Level | 3 — Medium |
| Kind | `cli` |
| Tags | `memory`, `recursion`, `allocation`, `garbage-collection`, `pointer-chasing` |
| Languages | Go, Rust, C++, Assembly, Python, JavaScript |

## Goal

The Computer Language Benchmarks Game "binary-trees", sequential. Millions of tiny tree nodes are
allocated, walked and thrown away while one long-lived tree stays in memory: it measures
allocation speed, garbage collector or allocator pressure and recursive pointer chasing.

## Specification

**Invocation:** `binary-trees N`

**Input**

- Exactly one argument `N`, made only of ASCII digits `0-9` (no sign, no spaces, no
  underscores; leading zeros allowed), with `0 ≤ N ≤ 21`.

**Trees**

- A node holds two child references; a leaf has none (null / `None` / `nullptr`).
- `tree(0)` is a leaf; `tree(d)` is a node whose children are `tree(d−1)` and `tree(d−1)`,
  built bottom-up recursively. A tree of depth `d` has `2^(d+1) − 1` nodes.
- `check(node)` = `1` for a leaf, `1 + check(left) + check(right)` otherwise (the node count,
  obtained by walking the whole tree).

**Output**

With `minDepth = 4`, `maxDepth = max(minDepth + 2, N)` (so `N = 0..6` all behave like `6`) and
`stretchDepth = maxDepth + 1`, write to stdout — note the **tab followed by a space** before
`check:` and before `trees`:

1. Build a tree of depth `stretchDepth`, check it and drop it:
   `stretch tree of depth {stretchDepth}\t check: {check}\n`
2. Build a long-lived tree of depth `maxDepth` and keep it alive while step 3 runs.
3. For `depth = minDepth, minDepth + 2, …` while `depth ≤ maxDepth`:
   `iterations = 2^(maxDepth − depth + minDepth)`; build, check and drop `iterations` trees of that
   depth one at a time, summing their checks:
   `{iterations}\t trees of depth {depth}\t check: {sum}\n`
4. `long lived tree of depth {maxDepth}\t check: {check of the long-lived tree}\n`

Exit code `0`. Example, `binary-trees 10` (`→` is a tab):

```text
stretch tree of depth 11→ check: 4095
1024→ trees of depth 4→ check: 31744
256→ trees of depth 6→ check: 32512
64→ trees of depth 8→ check: 32704
16→ trees of depth 10→ check: 32752
long lived tree of depth 10→ check: 2047
```

**Errors**

- Missing argument, extra arguments, non-digit characters or `N > 21`: print a usage message to
  **stderr**, nothing to stdout, exit code `1`.

**Rules**

- Recursive build and check exactly as above; no shortcut that skips building or walking a tree.
- One heap allocation per node where the language has a general-purpose allocator: GC objects (Go,
  JavaScript), `Box<Node>` with `Option<Box<Node>>` children (Rust, with the toolchain's default
  allocator), `std::unique_ptr<Node>` (C++), `(left, right)` tuples (Python). No memory pools or
  arenas, no threads, no worker processes.
- Assembly has no allocator: it carves 16-byte nodes with a bump pointer from its own `mmap`'d
  arenas, releasing an arena (by `munmap` or by resetting the bump pointer) when its tree is
  dropped; the long-lived tree has its own arena.
- Output must be buffered.

## Verification cases

| Name | Args | Exit | Expected stdout |
|------|------|------|-----------------|
| zero behaves like six | `0` | 0 | 4 lines, same as `6` |
| minimum depth | `6` | 0 | `stretch tree of depth 7→ check: 255`, `64→ trees of depth 4→ check: 1984`, `16→ trees of depth 6→ check: 2032`, `long lived tree of depth 6→ check: 127` |
| depth ten | `10` | 0 | 6 lines (see the example above) |
| depth twelve | `12` | 0 | 7 lines, stretch check `16383`, long-lived check `8191` |
| leading zeros | `010` | 0 | same as `10` |
| missing argument | — | 1 | empty |
| too many arguments | `5 5` | 1 | empty |
| not a number | `abc` | 1 | empty |
| negative | `-5` | 1 | empty |
| plus sign | `+5` | 1 | empty |
| too large | `22` | 1 | empty |

The exact expected text of every case is in `projects/binary-trees/project.json`.

## Benchmark cases

| Id | Args | Warmup | Runs | Output | What it shows |
|----|------|--------|------|--------|---------------|
| `depth-10` | `10` | 3 | 20 | 223 B, sha256 `b7f92c56…c3cb` | Startup plus a short burst of allocation (1,360 trees, ~136,000 nodes) |
| `depth-16` | `16` | 1 | 10 | sha256 `3b9e63e2…d7ff` | Allocator / GC throughput: 87,376 trees, ~14.6 million nodes next to a 131,071-node long-lived tree |

## Implementation notes

| Language | Approach |
|----------|----------|
| Go | `&Node{}` per node on the GC heap (default `GOGC`); recursive build and check; `bufio.Writer` 64 KiB |
| Rust | `Box<Node>` with `Option<Box<Node>>` children; drop frees node by node through musl's malloc; `BufWriter` over locked stdout |
| C++ | `std::make_unique<Node>` per node; `unique_ptr` destructors free the tree recursively; `std::cout` with `sync_with_stdio(false)` |
| Assembly | x86-64 NASM, raw `write`/`mmap`/`munmap`/`exit` syscalls; bump-pointer arenas sized for one tree each; one `write` at the end |
| Python | `(left, right)` tuples built from variables (every node, leaves included, is a fresh tuple); reference counting frees dropped trees |
| JavaScript | `Node` class instances (one hidden class); dropped trees die in V8's young generation; output written once, honoring `drain` |
