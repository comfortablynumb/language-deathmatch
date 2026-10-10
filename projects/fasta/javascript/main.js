// Fasta: generate three DNA sequences in FASTA format (Benchmarks Game, sequential).
'use strict';

const { once } = require('node:events');

const MAX_COUNT = 25_000_000;
const LINE_WIDTH = 60;
const CHUNK_SIZE = 64 * 1024;
const NEWLINE = 0x0a;
const USAGE = 'usage: fasta N  (N: 0..25000000)';

// Linear congruential generator: seed = (seed * IA + IC) % IM.
const IM = 139968;
const IA = 3877;
const IC = 29573;
const SEED = 42;

const ALU =
  'GGCCGGGCGCGGTGGCTCACGCCTGTAATCCCAGCACTTTGG' +
  'GAGGCCGAGGCGGGCGGATCACCTGAGGTCAGGAGTTCGAGA' +
  'CCAGCCTGGCCAACATGGTGAAACCCCGTCTCTACTAAAAAT' +
  'ACAAAAATTAGCCGGGCGTGGTGGCGCGCGCCTGTAATCCCA' +
  'GCTACTCGGGAGGCTGAGGCAGGAGAATCGCTTGAACCCGGG' +
  'AGGCGGAGGTTGCAGTGAGCCGAGATCGCGCCACTGCACTCC' +
  'AGCCTGGGCGACAGAGCGAGACTCCGTCTCAAAAA';

const IUB = [
  ['a', 0.27], ['c', 0.12], ['g', 0.12], ['t', 0.27],
  ['B', 0.02], ['D', 0.02], ['H', 0.02], ['K', 0.02], ['M', 0.02],
  ['N', 0.02], ['R', 0.02], ['S', 0.02], ['V', 0.02], ['W', 0.02], ['Y', 0.02],
];

const HOMO_SAPIENS = [
  ['a', 0.3029549426680],
  ['c', 0.1979883004921],
  ['g', 0.1975473066391],
  ['t', 0.3015094502008],
];

/** Symbol bytes plus their cumulative probabilities (running double sum), in table order. */
function makeTable(entries) {
  const symbols = Buffer.from(entries.map(([symbol]) => symbol).join(''), 'latin1');
  const cumulative = new Float64Array(entries.length);
  let sum = 0;

  entries.forEach(([, probability], i) => {
    sum += probability;
    cumulative[i] = sum;
  });

  return { symbols, cumulative };
}

/** The first symbol whose cumulative probability exceeds r, else the last one. */
function pick(table, r) {
  const { symbols, cumulative } = table;

  for (let i = 0; i < cumulative.length; i++) {
    if (r < cumulative[i]) {
      return symbols[i];
    }
  }

  return symbols[symbols.length - 1];
}

/** The generator shared by records TWO and THREE. */
class Random {
  constructor(seed) {
    this.seed = seed;
  }

  /** Advances the generator and returns seed / IM in [0, 1); integers stay exact (< 2^30). */
  next() {
    this.seed = (this.seed * IA + IC) % IM;
    return this.seed / IM;
  }
}

/** Collects bytes into 64 KiB chunks and writes them honoring stdout back-pressure. */
class ChunkWriter {
  constructor(stream) {
    this.stream = stream;
    this.chunk = Buffer.allocUnsafe(CHUNK_SIZE);
    this.length = 0;
  }

  /** Appends bytes; returns true when the chunk may not fit another line and must be flushed. */
  push(bytes) {
    this.chunk.set(bytes, this.length);
    this.length += bytes.length;
    return this.length > CHUNK_SIZE - (LINE_WIDTH + 1);
  }

  /** Hands the chunk to the stream (which keeps it) and starts a new one. */
  async flush() {
    const full = this.chunk.subarray(0, this.length);
    this.chunk = Buffer.allocUnsafe(CHUNK_SIZE);
    this.length = 0;

    if (!this.stream.write(full)) {
      await once(this.stream, 'drain');
    }
  }
}

/** Accepts exactly one argument made only of ASCII digits. */
function parseCount(args) {
  if (args.length !== 1 || !/^[0-9]+$/.test(args[0])) {
    return null;
  }

  const n = Number(args[0]);
  return n <= MAX_COUNT ? n : null;
}

/** Writes one line (at most LINE_WIDTH + 1 bytes), flushing the chunk when it is full. */
async function writeLine(out, bytes) {
  if (out.push(bytes)) {
    await out.flush();
  }
}

/** Writes n characters of s repeated cyclically, LINE_WIDTH per line. */
async function writeRepeat(out, s, n) {
  const extended = Buffer.from(s + s.slice(0, LINE_WIDTH), 'latin1'); // lines never wrap
  const line = new Uint8Array(LINE_WIDTH + 1);
  let pos = 0;

  for (let left = n; left > 0; left -= LINE_WIDTH) {
    const count = Math.min(LINE_WIDTH, left);
    line.set(extended.subarray(pos, pos + count));
    line[count] = NEWLINE;
    await writeLine(out, line.subarray(0, count + 1));
    pos = (pos + count) % s.length;
  }
}

/** Writes n symbols picked from table, one generator step each, LINE_WIDTH per line. */
async function writeRandom(out, random, table, n) {
  const line = new Uint8Array(LINE_WIDTH + 1);

  for (let left = n; left > 0; left -= LINE_WIDTH) {
    const count = Math.min(LINE_WIDTH, left);

    for (let i = 0; i < count; i++) {
      line[i] = pick(table, random.next());
    }

    line[count] = NEWLINE;
    await writeLine(out, line.subarray(0, count + 1));
  }
}

/** Writes the three records; one generator serves both random ones. */
async function writeFasta(stream, n) {
  const out = new ChunkWriter(stream);
  const random = new Random(SEED);

  await writeLine(out, Buffer.from('>ONE Homo sapiens alu\n', 'latin1'));
  await writeRepeat(out, ALU, 2 * n);
  await writeLine(out, Buffer.from('>TWO IUB ambiguity codes\n', 'latin1'));
  await writeRandom(out, random, makeTable(IUB), 3 * n);
  await writeLine(out, Buffer.from('>THREE Homo sapiens frequency\n', 'latin1'));
  await writeRandom(out, random, makeTable(HOMO_SAPIENS), 5 * n);
  await out.flush();
}

async function main() {
  const n = parseCount(process.argv.slice(2));

  if (n === null) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  await writeFasta(process.stdout, n);
}

main().catch((err) => {
  console.error(`fasta: ${err.message}`);
  process.exitCode = 1;
});
