/* Leaderboard: geometric mean of relative factors across every benchmark case. */
import * as format from '../lib/format.js';
import * as stats from '../lib/stats.js';
import * as c from '../ui/components.js';
import * as charts from '../ui/charts.js';
import * as shared from './shared.js';

const e = format.escapeHtml;

const METRIC_ITEMS = [{ id: 'wall', label: 'Wall time' }, { id: 'cpu', label: 'CPU time' }, { id: 'memory', label: 'Peak memory' }];

function tableHtml(ctx, rows) {
  const body = rows.map((r) => {
    const language = ctx.catalog.languages.find((l) => l.id === r.language);
    return `<tr><td class="font-semibold text-ink">${r.rank}</td>
      <td><span class="inline-flex items-center gap-2 text-ink">${c.langDot(language)}${e(language ? language.name : r.language)}</span></td>
      <td class="font-semibold text-ink">${format.factor(r.score)}</td><td>${r.cases}</td><td>${r.wins}</td></tr>`;
  }).join('');

  return `<div class="overflow-x-auto"><table class="data-table">
    <thead><tr><th>#</th><th>Language</th><th>Score</th><th>Cases</th><th>Wins</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function draw(ctx, rows, state) {
  state.charts.forEach((chart) => charts.dispose(chart));
  const names = rows.map((r) => c.languageName(ctx.catalog, r.language));
  const element = ctx.$root.find('[data-chart=score]')[0];

  state.charts = [charts.barChart(element, {
    categories: names,
    values: rows.map((r) => r.score),
    labels: rows.map((r) => format.factor(r.score)),
    tooltips: rows.map((r, i) => `<b>${e(names[i])}</b><br>score ${format.factor(r.score)}<br>${format.plural(r.cases, 'case')} · ${format.plural(r.wins, 'win')}`),
    format: (v) => `${format.sigfig(v, 3)}×`,
    log: false,
  })];
}

function renderBoard(ctx, state) {
  const rows = stats.leaderboard(ctx.results, state.metric);
  ctx.$root.find('#board').html(`<div class="grid gap-6 xl:grid-cols-2">
    ${c.panel(`Overall · ${stats.metricInfo(state.metric).label}`, '1.00× = fastest (or leanest) in every case; lower is better', '<div data-chart="score"></div>')}
    ${c.panel('Ranking', 'Score = geometric mean of median ÷ best median over every case completed', tableHtml(ctx, rows))}
  </div>`);
  draw(ctx, rows, state);
  ctx.$root.find('[data-metric]').attr('aria-pressed', function () { return String($(this).attr('data-metric') === state.metric); });
  shared.replaceQuery(ctx.route, { metric: state.metric === 'wall' ? '' : state.metric });
}

export function render(ctx) {
  document.title = format.pageTitle('Leaderboard');
  const intro = `<h1 class="text-3xl font-bold tracking-tight sm:text-4xl">Leaderboard</h1>
    <p class="mt-2 max-w-3xl text-ink-2">Every benchmark case of every project, combined. A language's score is the geometric mean of how
    many times slower (or heavier) it was than the winner of each case, so one outlier cannot dominate.</p>`;

  if (!ctx.results) {
    ctx.$root.html(`${intro}<div class="mt-8">${c.emptyState('No benchmark results yet', 'Run <code class="font-mono text-ink">bin/bench.sh</code> to produce them.')}</div>`);
    return;
  }

  const metric = METRIC_ITEMS.some((m) => m.id === ctx.route.query.metric) ? ctx.route.query.metric : 'wall';
  const state = { metric, charts: [] };
  ctx.$root.html(`${intro}<div class="mt-6">${c.segmented('metric', METRIC_ITEMS, metric, 'Metric')}</div><div id="board" class="mt-6"></div>`);
  ctx.$root.on('click', '[data-metric]', function () { renderBoard(ctx, Object.assign(state, { metric: $(this).attr('data-metric') })); });
  renderBoard(ctx, state);
}
