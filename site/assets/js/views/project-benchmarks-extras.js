/* Benchmarks tab extras: static metrics (lines of code, image size) and verification status. */
import * as format from '../lib/format.js';
import * as c from '../ui/components.js';
import * as charts from '../ui/charts.js';
import * as shared from './shared.js';

const e = format.escapeHtml;

export function staticPanels() {
  return `${c.panel('Lines of code', 'Non-blank lines of the source files', '<div data-chart="loc"></div>')}
    ${c.panel('Image size', 'Uncompressed final Docker image (sum of its layers)', '<div data-chart="image"></div>')}`;
}

/** Draws a simple ranked bar chart of { language, value } rows. */
function drawRows(ctx, element, rows, fmt) {
  const sorted = [...rows].sort((a, b) => a.value - b.value);
  const names = sorted.map((r) => c.languageName(ctx.catalog, r.language));

  charts.barChart(element, {
    categories: names,
    values: sorted.map((r) => r.value),
    labels: sorted.map((r) => fmt(r.value)),
    tooltips: sorted.map((r, i) => `<b>${e(names[i])}</b><br>${fmt(r.value)}`),
    format: fmt,
    log: false,
  });
}

export function drawStatic(ctx) {
  const loc = ctx.project.implementations.map((impl) => ({ language: impl.language, value: impl.loc }));
  const images = ctx.project.implementations
    .map((impl) => shared.resultFor(ctx, ctx.project, impl.language))
    .filter((r) => r && r.image.sizeBytes > 0)
    .map((r) => ({ language: r.language, value: r.image.sizeBytes }));

  drawRows(ctx, ctx.$panel.find('[data-chart=loc]')[0], loc, (v) => format.number(v));

  if (images.length) {
    drawRows(ctx, ctx.$panel.find('[data-chart=image]')[0], images, (v) => format.bytes(v));
  } else {
    ctx.$panel.find('[data-chart=image]').html('<p class="text-sm text-ink-3">No image sizes recorded.</p>');
  }
}

function verificationRow(ctx, impl) {
  const language = ctx.catalog.languages.find((l) => l.id === impl.language);
  const result = shared.resultFor(ctx, ctx.project, impl.language);
  const name = `<span class="inline-flex items-center gap-2 text-ink">${c.langDot(language)}${e(language.name)}</span>`;

  if (!result) {
    return `<li class="flex items-center justify-between gap-3 py-2">${name}<span class="chip">not run</span></li>`;
  }

  const passed = result.verification.filter((v) => v.passed).length;
  const badge = c.statusBadge(result.status === 'ok', `${passed}/${result.verification.length} passed`);
  const error = result.error ? `<p class="mt-1 text-xs break-words text-critical">${e(result.error)}</p>` : '';
  return `<li class="py-2"><div class="flex items-center justify-between gap-3">${name}${badge}</div>${error}</li>`;
}

export function verificationPanel(ctx) {
  const rows = ctx.project.implementations.map((impl) => verificationRow(ctx, impl)).join('');
  return c.panel('Verification', 'Output checked against every verification case before timing.',
    `<ul class="divide-y divide-line/60 text-sm">${rows}</ul>`);
}
