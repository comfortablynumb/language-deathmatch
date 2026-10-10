/* Project tab: Compare two implementations side by side. */
import * as format from '../lib/format.js';
import * as stats from '../lib/stats.js';
import * as router from '../lib/router.js';
import * as c from '../ui/components.js';
import * as codeView from '../ui/code.js';
import * as shared from './shared.js';
import { pickImplementation } from './project-code.js';

const e = format.escapeHtml;

const METRICS = ['wall', 'cpu', 'memory'];

function picker(ctx, id, selected) {
  const options = ctx.project.implementations.map((impl) => `<option value="${e(impl.language)}" ${impl.language === selected ? 'selected' : ''}>
    ${e(c.languageName(ctx.catalog, impl.language))}</option>`).join('');

  return `<select id="${id}" class="field sm:w-56" aria-label="${id === 'cmp-a' ? 'Left' : 'Right'} language">${options}</select>`;
}

/** v = { a, b, valueA, valueB, verb } — a/b are language ids; lower values win. */
function verdict(ctx, v) {
  if (!Number.isFinite(v.valueA) || !Number.isFinite(v.valueB)) {
    return '–';
  }

  const result = stats.compare(v.valueA, v.valueB);

  if (result.winner === 'tie') {
    return '<span class="text-ink-3">tie</span>';
  }

  const winner = c.languageName(ctx.catalog, result.winner === 'a' ? v.a : v.b);
  return `<span class="text-ink"><b>${e(winner)}</b> ${format.factor(result.factor)} ${e(v.verb)}</span>`;
}

function caseRows(ctx, a, b) {
  const ra = shared.resultFor(ctx, ctx.project, a);
  const rb = shared.resultFor(ctx, ctx.project, b);

  return ctx.project.benchmarks.flatMap((bench) => METRICS.map((metric) => {
    const ca = stats.findCase(ra, bench.id);
    const cb = stats.findCase(rb, bench.id);
    const fmt = shared.metricFormatter(metric);
    const va = ca ? stats.summary(ca, metric).median : NaN;
    const vb = cb ? stats.summary(cb, metric).median : NaN;
    const info = stats.metricInfo(metric);
    return `<tr><td class="text-ink">${e(bench.name)} · ${e(info.label)}</td>
      <td>${ca ? fmt(va) : '–'}</td><td>${cb ? fmt(vb) : '–'}</td>
      <td>${verdict(ctx, { a, b, valueA: va, valueB: vb, verb: info.better })}</td></tr>`;
  }));
}

function staticRows(ctx, implA, implB) {
  const size = (lang) => {
    const r = shared.resultFor(ctx, ctx.project, lang);
    return r && r.image.sizeBytes ? r.image.sizeBytes : NaN;
  };
  const sizeA = size(implA.language);
  const sizeB = size(implB.language);
  const fmtSize = (v) => (Number.isFinite(v) ? format.bytes(v) : '–');

  const pair = { a: implA.language, b: implB.language };

  return `<tr><td class="text-ink">Lines of code</td><td>${implA.loc}</td><td>${implB.loc}</td>
      <td>${verdict(ctx, { ...pair, valueA: implA.loc, valueB: implB.loc, verb: 'shorter' })}</td></tr>
    <tr><td class="text-ink">Image size</td><td>${fmtSize(sizeA)}</td><td>${fmtSize(sizeB)}</td>
      <td>${verdict(ctx, { ...pair, valueA: sizeA, valueB: sizeB, verb: 'smaller' })}</td></tr>`;
}

function summaryTable(ctx, implA, implB) {
  const name = (impl) => e(c.languageName(ctx.catalog, impl.language));
  const rows = ctx.results ? caseRows(ctx, implA.language, implB.language).join('') : '';

  return c.panel('Head to head', 'Medians from the latest benchmark run; lower is better.', `<div class="overflow-x-auto"><table class="data-table">
    <thead><tr><th>Metric</th><th>${name(implA)}</th><th>${name(implB)}</th><th>Verdict</th></tr></thead>
    <tbody>${rows}${staticRows(ctx, implA, implB)}</tbody></table></div>`);
}

function sources(impl) {
  return [...impl.files].sort((x, y) => (x.role === y.role ? 0 : x.role === 'source' ? -1 : 1));
}

export function compare(ctx) {
  const pick = pickImplementation;
  const implA = pick(ctx.project, ctx.route.params.a);
  const fallbackB = ctx.project.implementations.find((i) => i.language !== implA.language) || implA;
  const implB = ctx.route.params.b ? pick(ctx.project, ctx.route.params.b) : fallbackB;
  const filesA = sources(implA);
  const filesB = sources(implB);

  ctx.$panel.html(`<div class="flex flex-wrap items-center gap-3">${picker(ctx, 'cmp-a', implA.language)}
      <span class="text-sm font-semibold text-ink-3">vs</span>${picker(ctx, 'cmp-b', implB.language)}</div>
    <div class="mt-6">${summaryTable(ctx, implA, implB)}</div>
    <div class="mt-6 grid gap-6 lg:grid-cols-2">${codeView.viewer(filesA)}${codeView.viewer(filesB)}</div>`);
  codeView.mount(ctx.$panel, [filesA, filesB]);

  ctx.$panel.on('change', '#cmp-a, #cmp-b', () => {
    const a = ctx.$panel.find('#cmp-a').val();
    const b = ctx.$panel.find('#cmp-b').val();
    location.hash = router.build('project', { id: ctx.project.id, tab: 'compare', a, b });
  });
}
