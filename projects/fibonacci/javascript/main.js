// Fibonacci: print the first N Fibonacci numbers (mod 2^64), one per line.
'use strict';

const { once } = require('node:events');

const MAX_COUNT = 1_000_000_000;
const CHUNK_SIZE = 64 * 1024;
const USAGE = 'usage: fibonacci N  (N: 0..1000000000)';

/** Accepts exactly one argument made only of ASCII digits. */
function parseCount(args) {
  if (args.length !== 1 || !/^[0-9]+$/.test(args[0])) {
    return null;
  }

  const n = Number(args[0]);
  return n <= MAX_COUNT ? n : null;
}

/** Writes a chunk, waiting for 'drain' when stdout applies back-pressure. */
async function write(stream, chunk) {
  if (!stream.write(chunk)) {
    await once(stream, 'drain');
  }
}

/** Writes F(0)..F(n-1); BigInt.asUintN(64, …) keeps 64-bit wrapping semantics. */
async function writeFibonacci(stream, n) {
  let a = 0n;
  let b = 1n;
  let chunk = '';

  for (let i = 0; i < n; i++) {
    chunk += `${a}\n`;

    if (chunk.length >= CHUNK_SIZE) {
      await write(stream, chunk);
      chunk = '';
    }

    [a, b] = [b, BigInt.asUintN(64, a + b)];
  }

  await write(stream, chunk);
}

async function main() {
  const n = parseCount(process.argv.slice(2));

  if (n === null) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  await writeFibonacci(process.stdout, n);
}

main().catch((err) => {
  console.error(`fibonacci: ${err.message}`);
  process.exitCode = 1;
});
