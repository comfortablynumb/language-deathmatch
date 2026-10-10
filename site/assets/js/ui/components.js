/* Reusable HTML builders. Every interpolated value goes through escapeHtml. */
import * as format from '../lib/format.js';

const e = format.escapeHtml;

/** Map of language id → language for quick lookups. */
export function languageMap(catalog) {
  return new Map(catalog.languages.map((l) => [l.id, l]));
}

export function languageName(catalog, id) {
  const language = catalog.languages.find((l) => l.id === id);
  return language ? language.name : id;
}

function colorStyle(language) {
  return language ? `style="--lang-color:${e(language.color)}"` : '';
}

export function langDot(language) {
  return `<span class="lang-dot" ${colorStyle(language)} aria-hidden="true"></span>`;
}

export function langChip(language) {
  return `<span class="chip" ${colorStyle(language)}>${langDot(language)}${e(language.name)}</span>`;
}

/** Level badge: five pips plus the level name. */
export function levelBadge(levelNumber, levels) {
  const level = levels.find((l) => l.level === levelNumber) || { name: '' };
  const pips = levels.map((l) =>
    `<span class="size-1.5 rounded-full ${l.level <= levelNumber ? 'bg-accent' : 'bg-line'}"></span>`).join('');

  return `<span class="chip" title="Complexity level ${levelNumber} of ${levels.length}: ${e(level.name)}">
    <span class="flex gap-0.5" aria-hidden="true">${pips}</span>L${levelNumber} · ${e(level.name)}</span>`;
}

export function categoryChip(catalog, categoryId) {
  const category = catalog.categories.find((c) => c.id === categoryId);
  return `<span class="chip text-ink">${e(category ? category.name : categoryId)}</span>`;
}

export function tagChips(tags) {
  return (tags || []).map((tag) => `<span class="chip">#${e(tag)}</span>`).join('');
}

export function statusBadge(ok, text) {
  const tone = ok ? 'border-good/40 text-good' : 'border-critical/50 text-critical';
  const icon = ok ? '✓' : '✕';
  return `<span class="chip ${tone}"><span aria-hidden="true">${icon}</span>${e(text)}</span>`;
}

export function statTile(label, value, hint) {
  return `<div class="rounded-xl border border-line bg-page/60 px-4 py-3">
    <div class="text-xs font-medium tracking-wide text-ink-3 uppercase">${e(label)}</div>
    <div class="mt-1 text-2xl font-bold">${e(value)}</div>
    ${hint ? `<div class="mt-0.5 truncate text-xs text-ink-3">${e(hint)}</div>` : ''}
  </div>`;
}

export function emptyState(title, body) {
  return `<div class="card flex flex-col items-center px-6 py-14 text-center">
    <div class="text-3xl" aria-hidden="true">⚔️</div>
    <h3 class="mt-3 text-lg font-semibold">${e(title)}</h3>
    <p class="mt-2 max-w-md text-sm text-ink-2">${body}</p>
  </div>`;
}

export function skeleton() {
  return `<div class="space-y-4" aria-busy="true" aria-label="Loading">
    <div class="skeleton h-10 w-1/3"></div><div class="skeleton h-5 w-2/3"></div><div class="skeleton h-64"></div>
  </div>`;
}

export function sectionTitle(title, subtitle) {
  return `<div><h2 class="text-xl font-semibold">${e(title)}</h2>
    ${subtitle ? `<p class="mt-1 text-sm text-ink-3">${e(subtitle)}</p>` : ''}</div>`;
}

/** Segmented control; items: [{ id, label }]. Buttons carry data-<name>="<id>". */
export function segmented(name, items, activeId, ariaLabel) {
  const buttons = items.map((item) => `<button type="button" class="pill" data-${e(name)}="${e(item.id)}"
    aria-pressed="${item.id === activeId}">${e(item.label)}</button>`).join('');

  return `<div class="flex flex-wrap gap-2" role="group" aria-label="${e(ariaLabel)}">${buttons}</div>`;
}

/** Card wrapper with a title row. */
export function panel(title, subtitle, body) {
  return `<section class="card p-5 sm:p-6">${sectionTitle(title, subtitle)}<div class="mt-5">${body}</div></section>`;
}
