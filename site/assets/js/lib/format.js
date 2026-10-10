/* Formatting helpers: durations, memory, sizes, factors, HTML escaping. Pure, no DOM. */
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const SITE_NAME = 'Language Deathmatch';

/** Document title: ("Leaderboard") → "Leaderboard · Language Deathmatch"; () → the site name. */
export function pageTitle(...parts) {
  return [...parts.filter(Boolean), SITE_NAME].join(' · ');
}

/** Escapes text for safe interpolation into HTML. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** Rounds to `digits` significant digits and drops trailing zeros. */
export function sigfig(value, digits = 3) {
  if (!Number.isFinite(value) || value === 0) {
    return '0';
  }

  return String(Number(value.toPrecision(digits)));
}

/** Picks the largest unit whose factor is <= value; units sorted ascending. */
function scaled(value, units, digits) {
  if (value === 0) {
    return '0';
  }

  let unit = units[0];

  for (const candidate of units) {
    if (Math.abs(value) >= candidate.factor) {
      unit = candidate;
    }
  }

  return `${sigfig(value / unit.factor, digits)} ${unit.label}`;
}

const TIME_UNITS = [
  { factor: 1, label: 'ns' },
  { factor: 1e3, label: 'µs' },
  { factor: 1e6, label: 'ms' },
  { factor: 1e9, label: 's' },
];

const BINARY_UNITS = [
  { factor: 1, label: 'B' },
  { factor: 1024, label: 'KiB' },
  { factor: 1024 ** 2, label: 'MiB' },
  { factor: 1024 ** 3, label: 'GiB' },
];

/** 151000 → "151 µs", 17690000 → "17.7 ms". */
export function duration(ns, digits = 3) {
  return scaled(ns, TIME_UNITS, digits);
}

/** Bytes in binary units: 24576 → "24 KiB". */
export function bytes(value, digits = 3) {
  return scaled(value, BINARY_UNITS, digits);
}

/** KiB (as reported by ru_maxrss) in binary units. */
export function memory(kib, digits = 3) {
  return bytes(kib * 1024, digits);
}

/** Relative factor: 1 → "1.00×", 41.27 → "41.3×", 117.4 → "117×". */
export function factor(value) {
  if (!Number.isFinite(value)) {
    return '–';
  }

  return value < 10 ? `${value.toFixed(2)}×` : `${sigfig(value, 3)}×`;
}

/** Integer with thousands separators: 2000000 → "2,000,000". */
export function number(value) {
  return Number(value).toLocaleString('en-US');
}

/** ISO date → "2026-10-08 23:40 UTC". */
export function dateTime(iso) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '–';
  }

  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** Command line preview: ["10"] → "fibonacci 10". */
export function commandLine(program, args) {
  return [program, ...(args || [])].join(' ');
}

/** Singular/plural label: (1, "case") → "1 case", (2, "case") → "2 cases". */
export function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
