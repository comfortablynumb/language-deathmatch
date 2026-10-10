// Binary trees: allocate, walk and discard perfect binary trees (Benchmarks Game, sequential).
'use strict';

const { once } = require('node:events');

const MIN_DEPTH = 4;
const MAX_INPUT = 21;
const USAGE = 'usage: binary-trees N  (N: 0..21)';

/** One heap-allocated tree node; a leaf has null children. */
class Node {
  constructor(left, right) {
    this.left = left;
    this.right = right;
  }
}

/** Accepts exactly one argument made only of ASCII digits. */
function parseDepth(args) {
  if (args.length !== 1 || !/^[0-9]+$/.test(args[0])) {
    return null;
  }

  const n = Number(args[0]);
  return n <= MAX_INPUT ? n : null;
}

/** Allocates a perfect tree of the given depth, children before their parent. */
function bottomUpTree(depth) {
  if (depth === 0) {
    return new Node(null, null);
  }

  return new Node(bottomUpTree(depth - 1), bottomUpTree(depth - 1));
}

/** Walks the whole tree and returns its node count. */
function check(node) {
  if (node.left === null) {
    return 1;
  }

  return 1 + check(node.left) + check(node.right);
}

/** Builds, checks and drops `iterations` trees of `depth`, one at a time. */
function sumChecks(depth, iterations) {
  let sum = 0;

  for (let i = 0; i < iterations; i++) {
    sum += check(bottomUpTree(depth));
  }

  return sum;
}

/** Returns the output: stretch tree, one line per iteration depth, long-lived tree. */
function run(n) {
  const maxDepth = Math.max(MIN_DEPTH + 2, n);
  const stretchDepth = maxDepth + 1;
  const stretch = check(bottomUpTree(stretchDepth));
  let text = `stretch tree of depth ${stretchDepth}\t check: ${stretch}\n`;

  const longLived = bottomUpTree(maxDepth);

  for (let depth = MIN_DEPTH; depth <= maxDepth; depth += 2) {
    const iterations = 1 << (maxDepth - depth + MIN_DEPTH);
    const sum = sumChecks(depth, iterations);
    text += `${iterations}\t trees of depth ${depth}\t check: ${sum}\n`;
  }

  return text + `long lived tree of depth ${maxDepth}\t check: ${check(longLived)}\n`;
}

/** Writes a chunk, waiting for 'drain' when stdout applies back-pressure. */
async function write(stream, chunk) {
  if (!stream.write(chunk)) {
    await once(stream, 'drain');
  }
}

async function main() {
  const n = parseDepth(process.argv.slice(2));

  if (n === null) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  await write(process.stdout, run(n));
}

main().catch((err) => {
  console.error(`binary-trees: ${err.message}`);
  process.exitCode = 1;
});
