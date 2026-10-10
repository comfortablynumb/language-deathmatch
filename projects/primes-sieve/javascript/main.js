// Primes sieve: count, sum and find the largest prime up to N with the Sieve of Eratosthenes.
'use strict';

const MAX_LIMIT = 200_000_000;
const USAGE = 'usage: primes-sieve N  (N: 0..200000000)';

/** Accepts exactly one argument made only of ASCII digits. */
function parseLimit(args) {
  if (args.length !== 1 || !/^[0-9]+$/.test(args[0])) {
    return null;
  }

  const n = Number(args[0]);
  return n <= MAX_LIMIT ? n : null;
}

/** Returns one byte per integer 0..n: 1 when the integer is prime. */
function sieve(n) {
  const isPrime = new Uint8Array(n + 1).fill(1);
  isPrime.fill(0, 0, 2); // 0 and 1 are not prime

  for (let p = 2; p * p <= n; p++) {
    if (!isPrime[p]) {
      continue;
    }

    for (let multiple = p * p; multiple <= n; multiple += p) {
      isPrime[multiple] = 0;
    }
  }

  return isPrime;
}

/**
 * Counts and sums the primes and finds the largest one (0 when there is none).
 * The sum stays below 2^53 for N <= 200000000, so a Number is exact (no BigInt needed).
 */
function summarize(isPrime) {
  let count = 0;
  let sum = 0;
  let largest = 0;

  for (let i = 0; i < isPrime.length; i++) {
    if (isPrime[i]) {
      count++;
      sum += i;
      largest = i;
    }
  }

  return { count, sum, largest };
}

function main() {
  const n = parseLimit(process.argv.slice(2));

  if (n === null) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const { count, sum, largest } = summarize(sieve(n));
  process.stdout.write(`count: ${count}\nsum: ${sum}\nlargest: ${largest}\n`);
}

main();
