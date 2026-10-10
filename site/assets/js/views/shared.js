/* Helpers shared by the views: metric formatting, ranking charts and tables. */
import * as format from '../lib/format.js';
import * as stats from '../lib/stats.js';
import * as router from '../lib/router.js';
import * as c from '../ui/components.js';
import * as charts from '../ui/charts.js';

const e = format.escapeHtml;

/** Implementation result of a language for a project, or null. */
export function resultFor(ctx, project, language) {
  return ((ctx.results && ctx.results.results) || []).find((r) => r.project === project.id && r.language === language) || null;
}

/** Formatter for a metric's raw values (ns or KiB). */
export function metricFormatter(metric) {
  return metric === 'memory' ? (v) => format.memory(v) : (v) => format.duration(v);
}

function rankingTooltip(row, catalog, metric) {
  const fmt = metricFormatter(metric);
  const s = row.summary;

  return `<div class="font-semibold">${e(c.languageName(catalog, row.language))}</div>
    <div>median <b>${fmt(s.median)}</b> · ${format.factor(row.relative)}</div>
    <div>mean ${fmt(s.mean)} ± ${fmt(s.stddev)}</div>
    <div>min ${fmt(s.min)} · max ${fmt(s.max)} · ${format.plural(row.samples.length, 'sample')}</div>`;
}

/** Draws the ranked bar chart and the box plot for ranking rows; returns both charts. */
export function drawRanking(elements, rows, ctx) {
  const fmt = metricFormatter(ctx.metric);
  const categories = rows.map((r) => c.languageName(ctx.catalog, r.language));
  const tooltips = rows.map((r) => rankingTooltip(r, ctx.catalog, ctx.metric));
  const common = { categories, tooltips, format: fmt, log: ctx.log, logBase: ctx.metric === 'memory' ? 2 : 10 };

  const bar = charts.barChart(elements.bar, {
    ...common,
    values: rows.map((r) => r.value),
    labels: rows.map((r) => (r.rank === 1 ? fmt(r.value) : `${fmt(r.value)}  ${format.factor(r.relative)}`)),
  });

  const box = charts.boxPlot(elements.box, {
    ...common,
    boxes: rows.map((r) => [r.summary.min, r.summary.q1, r.summary.median, r.summary.q3, r.summary.max]),
    samples: rows.map((r) => r.samples),
  });

  return [bar, box];
}

const RANKING_COLUMNS = [
  { key: 'rank', label: '#' },
  { key: 'name', label: 'Language' },
  { key: 'value', label: 'Median' },
  { key: 'relative', label: 'Relative' },
  { key: 'mean', label: 'Mean ± sd' },
  { key: 'min', label: 'Min' },
  { key: 'max', label: 'Max' },
  { key: 'n', label: 'Samples' },
];

function rankingRowHtml(row, catalog, fmt) {
  const language = catalog.languages.find((l) => l.id === row.language);

  return `<tr>
    <td class="font-semibold text-ink">${row.rank}</td>
    <td><span class="inline-flex items-center gap-2 text-ink">${c.langDot(language)}${e(row.name)}</span></td>
    <td class="font-semibold text-ink">${fmt(row.value)}</td>
    <td>${format.factor(row.relative)}</td>
    <td>${fmt(row.mean)} ± ${fmt(row.summary.stddev)}</td>
    <td>${fmt(row.min)}</td>
    <td>${fmt(row.max)}</td>
    <td>${row.n}</td>
  </tr>`;
}

/** Sortable ranking table; sort = { key, dir }. Header buttons carry data-sort. */
export function rankingTable(rows, ctx, sort) {
  const fmt = metricFormatter(ctx.metric);
  const enriched = rows.map((r) => ({
    ...r, name: c.languageName(ctx.catalog, r.language), mean: r.summary.mean,
    min: r.summary.min, max: r.summary.max, n: r.samples.length,
  }));
  const sorted = stats.sortRows(enriched, sort.key, sort.dir);
  const head = RANKING_COLUMNS.map((col) => {
    const arrow = col.key === sort.key ? (sort.dir === 'asc' ? '↑' : '↓') : '';
    const ariaSort = col.key === sort.key ? `aria-sort="${sort.dir === 'asc' ? 'ascending' : 'descending'}"` : '';
    return `<th ${ariaSort}><button type="button" class="sort-button" data-sort="${col.key}">${col.label} ${arrow}</button></th>`;
  }).join('');

  return `<div class="overflow-x-auto"><table class="data-table">
    <thead><tr>${head}</tr></thead>
    <tbody>${sorted.map((r) => rankingRowHtml(r, ctx.catalog, fmt)).join('')}</tbody>
  </table></div>`;
}

/** Next sort state when a header is clicked. */
export function nextSort(sort, key) {
  return sort.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
}

/** Card with the environment of a benchmark run. */
export function environmentCard(results) {
  const env = results.environment || {};
  const rows = [
    ['CPU', `${env.cpuModel || 'unknown'}${env.cpus ? ` · ${env.cpus} CPUs` : ''}`],
    ['Kernel', env.kernel || 'unknown'],
    ['Architecture', env.arch || 'unknown'],
    ['Docker', env.docker || 'unknown'],
    ['Runner', env.runner || 'unknown'],
    ['Commit', results.commit || 'unknown'],
    ['Date', format.dateTime(results.generatedAt)],
  ];
  const items = rows.map(([k, v]) => `<div class="flex justify-between gap-4 border-b border-line/60 py-2 last:border-0">
    <dt class="text-ink-3">${k}</dt><dd class="truncate text-right text-ink-2">${e(v)}</dd></div>`).join('');

  return `<dl class="text-sm">${items}</dl>`;
}

/** Replaces the URL query without triggering a hashchange (keeps focus and scroll). */
export function replaceQuery(route, query) {
  history.replaceState(null, '', router.build(route.name, route.params, query));
}
