/* Project tab: Benchmarks (ranking charts, distribution, table, static metrics, environment). */
import * as format from '../lib/format.js';
import * as stats from '../lib/stats.js';
import * as c from '../ui/components.js';
import * as charts from '../ui/charts.js';
import * as shared from './shared.js';
import * as extras from './project-benchmarks-extras.js';

const e = format.escapeHtml;

const METRIC_ITEMS = [{ id: 'wall', label: 'Wall time' }, { id: 'cpu', label: 'CPU time' }, { id: 'memory', label: 'Peak memory' }];
const SCALE_ITEMS = [{ id: 'linear', label: 'Linear' }, { id: 'log', label: 'Log scale' }];

function initialState(ctx) {
  const q = ctx.route.query;
  const cases = ctx.project.benchmarks;

  return {
    caseId: cases.some((b) => b.id === q.case) ? q.case : cases[0].id,
    metric: METRIC_ITEMS.some((m) => m.id === q.metric) ? q.metric : 'wall',
    scale: q.scale === 'log' ? 'log' : 'linear',
    sort: { key: 'rank', dir: 'asc' },
    charts: [],
  };
}

function controls(ctx, state) {
  const cases = ctx.project.benchmarks.map((b) => ({ id: b.id, label: b.name }));

  return `<div class="flex flex-wrap items-center gap-x-6 gap-y-3">
    ${c.segmented('case', cases, state.caseId, 'Benchmark case')}
    ${c.segmented('metric', METRIC_ITEMS, state.metric, 'Metric')}
    ${c.segmented('scale', SCALE_ITEMS, state.scale, 'Axis scale')}
  </div>`;
}

function caseDescription(ctx, state) {
  const bench = ctx.project.benchmarks.find((b) => b.id === state.caseId);
  const runs = state.metric === 'memory' ? 'peak memory from traced memory runs' : `${bench.warmup} warmup · ${format.plural(bench.runs, 'timed run')}`;

  return `<p class="mt-4 text-sm text-ink-2">${e(bench.description)}
    <span class="text-ink-3">· <code class="font-mono">${e(format.commandLine(ctx.project.id, bench.args))}</code> · ${runs}</span></p>`;
}

function rankingHtml(ctx, state, rows) {
  const info = stats.metricInfo(state.metric);

  if (!rows.length) {
    return c.emptyState('No successful results for this case', 'Every implementation failed or has not been benchmarked yet.');
  }

  return `<div class="grid gap-6 xl:grid-cols-2">
      ${c.panel(`Median ${info.label.toLowerCase()}`, 'Lower is better · bar labels show the factor vs. the winner', '<div data-chart="bar"></div>')}
      ${c.panel('Distribution', 'Box: quartiles · whiskers: min–max · dots: individual runs', '<div data-chart="box"></div>')}
    </div>
    <div class="mt-6">${c.panel('Results', 'Click a column to sort.', `<div data-table>${shared.rankingTable(rows, { catalog: ctx.catalog, metric: state.metric }, state.sort)}</div>`)}</div>`;
}

function renderRanking(ctx, state) {
  state.charts.forEach((chart) => charts.dispose(chart));
  const rows = stats.rankCase(ctx.results, ctx.project.id, state.caseId, state.metric);
  const $area = ctx.$panel.find('#ranking');
  $area.html(caseDescription(ctx, state) + `<div class="mt-6">${rankingHtml(ctx, state, rows)}</div>`);

  if (rows.length) {
    const elements = { bar: $area.find('[data-chart=bar]')[0], box: $area.find('[data-chart=box]')[0] };
    state.charts = shared.drawRanking(elements, rows, { catalog: ctx.catalog, metric: state.metric, log: state.scale === 'log' });
  }

  ctx.$panel.find('[data-case]').attr('aria-pressed', function () { return String($(this).attr('data-case') === state.caseId); });
  ctx.$panel.find('[data-metric]').attr('aria-pressed', function () { return String($(this).attr('data-metric') === state.metric); });
  ctx.$panel.find('[data-scale]').attr('aria-pressed', function () { return String($(this).attr('data-scale') === state.scale); });
  shared.replaceQuery(ctx.route, { case: state.caseId, metric: state.metric, scale: state.scale === 'log' ? 'log' : '' });
}

function bind(ctx, state) {
  const rerender = (changes) => renderRanking(ctx, Object.assign(state, changes));

  ctx.$panel.on('click', '[data-case]', function () { rerender({ caseId: $(this).attr('data-case') }); });
  ctx.$panel.on('click', '[data-metric]', function () { rerender({ metric: $(this).attr('data-metric') }); });
  ctx.$panel.on('click', '[data-scale]', function () { rerender({ scale: $(this).attr('data-scale') }); });
  ctx.$panel.on('click', '[data-sort]', function () {
    state.sort = shared.nextSort(state.sort, $(this).attr('data-sort'));
    const rows = stats.rankCase(ctx.results, ctx.project.id, state.caseId, state.metric);
    ctx.$panel.find('[data-table]').html(shared.rankingTable(rows, { catalog: ctx.catalog, metric: state.metric }, state.sort));
  });
}

export function benchmarks(ctx) {
  if (!ctx.results) {
    ctx.$panel.html(c.emptyState('No benchmark results yet',
      'Run <code class="font-mono text-ink">bin/bench.sh</code> locally (Docker required) or let the CI benchmark workflow publish them.'));
    return;
  }

  const state = initialState(ctx);

  ctx.$panel.html(`${controls(ctx, state)}<div id="ranking"></div>
    <div class="mt-6 grid gap-6 xl:grid-cols-2">${extras.staticPanels()}</div>
    <div class="mt-6 grid gap-6 lg:grid-cols-2">${extras.verificationPanel(ctx)}${c.panel('Environment', 'Where these numbers were measured.', shared.environmentCard(ctx.results))}</div>`);
  bind(ctx, state);
  renderRanking(ctx, state);
  extras.drawStatic(ctx);
}
