// Mandelbrot: render the Mandelbrot set as an N×N binary PBM (P4) bitmap.
'use strict';

const { once } = require('node:events');

const MAX_SIZE = 16_000;
const MAX_ITERATIONS = 50;
const LIMIT = 4.0;
const CHUNK_SIZE = 64 * 1024;
const USAGE = 'usage: mandelbrot N  (N: 1..16000)';

/** Accepts exactly one argument made only of ASCII digits, 1..MAX_SIZE. */
function parseSize(args) {
  if (args.length !== 1 || !/^[0-9]+$/.test(args[0])) {
    return null;
  }

  const n = Number(args[0]);
  return n >= 1 && n <= MAX_SIZE ? n : null;
}

/** Writes a chunk, waiting for 'drain' when stdout applies back-pressure. */
async function write(stream, chunk) {
  if (!stream.write(chunk)) {
    await once(stream, 'drain');
  }
}

/** Iterates z = z² + c up to MAX_ITERATIONS times; true if |z|² stayed ≤ 4. */
function inSet(cr, ci) {
  let zr = 0.0;
  let zi = 0.0;
  let tr = 0.0;
  let ti = 0.0;

  for (let i = 0; i < MAX_ITERATIONS && tr + ti <= LIMIT; i++) {
    zi = 2.0 * zr * zi + ci;
    zr = tr - ti + cr;
    tr = zr * zr;
    ti = zi * zi;
  }

  return tr + ti <= LIMIT;
}

/** Packs the n pixels of row y into a zero-filled row, 8 per byte, most significant bit first. */
function renderRow(row, y, n) {
  const ci = (2.0 * y) / n - 1.0;

  for (let x = 0; x < n; x++) {
    const cr = (2.0 * x) / n - 1.5;

    if (inSet(cr, ci)) {
      row[x >> 3] |= 0x80 >> (x & 7);
    }
  }
}

/** Writes the PBM header, then the rows top to bottom in ~64 KiB chunks of whole rows. */
async function writeImage(stream, n) {
  const rowBytes = Math.ceil(n / 8);
  const rowsPerChunk = Math.max(1, Math.floor(CHUNK_SIZE / rowBytes));

  await write(stream, Buffer.from(`P4\n${n} ${n}\n`, 'ascii'));

  for (let y = 0; y < n; y += rowsPerChunk) {
    const rows = Math.min(rowsPerChunk, n - y);
    // A fresh zero-filled buffer per chunk: stdout may still hold the previous one.
    const chunk = Buffer.alloc(rows * rowBytes);

    for (let r = 0; r < rows; r++) {
      renderRow(chunk.subarray(r * rowBytes, (r + 1) * rowBytes), y + r, n);
    }

    await write(stream, chunk);
  }
}

async function main() {
  const n = parseSize(process.argv.slice(2));

  if (n === null) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  await writeImage(process.stdout, n);
}

main().catch((err) => {
  console.error(`mandelbrot: ${err.message}`);
  process.exitCode = 1;
});
