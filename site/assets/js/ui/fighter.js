/* Fighter and arena HTML builders: emblems, portraits, names, badges. Every value is escaped. */
import * as format from '../lib/format.js';

const e = format.escapeHtml;

function colorStyle(language) {
  return `--lang-color:${e(language.color)}`;
}

/** The fighter's glyph on a tile; size: 'sm' | 'md' | 'lg' | 'xl'. */
export function emblem(language, size = 'md') {
  const glyph = language.fighter.glyph;
  const long = [...glyph].length > 2 ? ' data-long' : '';
  const sizeClass = size === 'md' ? '' : ` emblem-${size}`;

  return `<span class="emblem${sizeClass}" style="${colorStyle(language)}"${long} aria-hidden="true">
    <span class="emblem-glyph">${e(glyph)}</span></span>`;
}

/** Name over nickname, e.g. "Rust" / "The Crab". */
export function nameplate(language, nameClass = 'text-lg') {
  return `<span class="min-w-0"><span class="block truncate font-display ${nameClass} leading-none tracking-wide uppercase text-ink">${e(language.name)}</span>
    <span class="block truncate text-xs text-ink-3">${e(language.fighter.nickname)}</span></span>`;
}

/** Emblem + nameplate in a row. */
export function fighterLine(language, size = 'sm') {
  return `<span class="inline-flex min-w-0 items-center gap-3">${emblem(language, size)}${nameplate(language)}</span>`;
}

/** Select-screen portrait button; data-fighter carries the language id. */
export function portrait(language, selected) {
  return `<button type="button" class="portrait" data-fighter="${e(language.id)}" aria-pressed="${selected}"
    aria-label="${e(`${language.name}, ${language.fighter.nickname}`)}">${emblem(language, 'md')}
    <span class="truncate">${e(language.name)}</span></button>`;
}

/** Style attribute value giving an element its arena color. */
export function arenaStyle(category) {
  return `--arena-color:${e(category.arena.color)}`;
}

/** "The Number Pit" over "Algorithms & Math". */
export function arenaTitle(category, stageClass = 'arena-stage') {
  return `<span class="block ${stageClass}">${e(category.arena.stage)}</span>
    <span class="mt-1 block text-xs font-medium tracking-wide text-ink-3 uppercase">${e(category.name)}</span>`;
}

const OUTCOME_BADGES = {
  won: ['border-good/50 text-good', '✓', 'Win'],
  lost: ['border-critical/60 text-critical', '✕', 'Loss'],
  draw: ['border-line text-ink-2', '=', 'Draw'],
};

/** Result chip for a fighter: outcome ('won' | 'lost' | 'draw') and score "2–1". */
export function outcomeBadge(outcome, score) {
  const [tone, icon, label] = OUTCOME_BADGES[outcome];
  return `<span class="chip ${tone}"><span aria-hidden="true">${icon}</span>${label} ${e(score)}</span>`;
}

/** Small gold/red badges: FATALITY, FLAWLESS ×n, BOSS, CHAMPION. */
export function badge(text, tone = 'gold') {
  const tones = {
    gold: 'border-gold/60 text-gold',
    blood: 'border-blood/70 text-[#f87171]',
  };

  return `<span class="chip ${tones[tone]} font-display text-sm tracking-wider uppercase">${e(text)}</span>`;
}
