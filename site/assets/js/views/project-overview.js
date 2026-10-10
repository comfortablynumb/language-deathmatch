/* Project tab: Overview (spec, verification cases, benchmark cases, podium). */
import * as format from '../lib/format.js';
import * as stats from '../lib/stats.js';
import * as router from '../lib/router.js';
import * as c from '../ui/components.js';

const e = format.escapeHtml;

function specCard(project) {
  const spec = project.spec;
  const rules = spec.rules.map((r) => `<li>${e(r)}</li>`).join('');

  return c.panel('Specification', 'Every implementation must follow it exactly.', `<div class="prose-ldm space-y-5">
    <p>${e(spec.description)}</p>
    <div><h3 class="text-sm font-semibold text-ink">Input</h3><p class="mt-1">${e(spec.input)}</p></div>
    <div><h3 class="text-sm font-semibold text-ink">Output</h3><p class="mt-1">${e(spec.output)}</p></div>
    <div><h3 class="text-sm font-semibold text-ink">Rules</h3><ul class="mt-2">${rules}</ul></div>
  </div>`);
}

function expected(vc) {
  if (vc.sha256) {
    return `<span title="${e(vc.sha256)}">sha256 <code class="font-mono text-ink">${e(vc.sha256.slice(0, 12))}…</code></span>`;
  }

  const preview = vc.stdout === '' ? '(empty)' : vc.stdout.replace(/\n/g, '⏎ ');
  return `<code class="font-mono text-ink">${e(preview.length > 60 ? `${preview.slice(0, 60)}…` : preview)}</code>`;
}

function verifyTable(project) {
  const rows = project.verify.map((vc) => `<tr>
    <td class="text-ink">${e(vc.name)}</td>
    <td><code class="font-mono">${e(format.commandLine(project.id, vc.args))}</code></td>
    <td>${vc.exitCode}</td>
    <td>${expected(vc)}</td>
  </tr>`).join('');

  return c.panel('Verification cases', 'Run against every implementation before benchmarking; stdout must match byte for byte.',
    `<div class="overflow-x-auto"><table class="data-table">
      <thead><tr><th>Case</th><th>Command</th><th>Exit</th><th>Expected stdout</th></tr></thead><tbody>${rows}</tbody>
    </table></div>`);
}

function benchmarkCases(project) {
  const items = project.benchmarks.map((b) => `<li class="rounded-xl border border-line bg-page/60 p-4">
    <div class="flex items-center justify-between gap-2"><span class="font-semibold">${e(b.name)}</span>
      <code class="font-mono text-xs text-ink-3">${e(format.commandLine(project.id, b.args))}</code></div>
    <p class="mt-1.5 text-sm text-ink-2">${e(b.description)}</p>
    <p class="mt-2 text-xs text-ink-3">${b.warmup} warmup · ${format.plural(b.runs, 'timed run')}</p>
  </li>`).join('');

  return c.panel('Benchmark cases', '', `<ul class="space-y-3">${items}</ul>`);
}

function podium(ctx, project) {
  if (!ctx.results) {
    return c.panel('Podium', '', '<p class="text-sm text-ink-3">No benchmark results yet.</p>');
  }

  const blocks = project.benchmarks.map((b) => {
    const top = stats.rankCase(ctx.results, project.id, b.id, 'wall').slice(0, 3);
    const rows = top.map((r) => `<li class="flex items-center justify-between gap-3 py-1.5">
      <span class="flex items-center gap-2"><span class="w-4 text-ink-3">${r.rank}</span>${c.langDot(ctx.catalog.languages.find((l) => l.id === r.language))}
      ${e(c.languageName(ctx.catalog, r.language))}</span>
      <span class="tabular-nums text-ink-2">${format.duration(r.value)}</span></li>`).join('');

    return `<div><div class="text-xs font-medium tracking-wide text-ink-3 uppercase">${e(b.name)} · median wall time</div><ol class="mt-1 text-sm">${rows}</ol></div>`;
  }).join('');
  const link = router.build('project', { id: project.id, tab: 'benchmarks' });

  return c.panel('Podium', '', `<div class="space-y-5">${blocks}</div>
    <a class="mt-5 inline-block text-sm font-medium text-accent hover:underline" href="${link}">All benchmark results →</a>`);
}

export function overview(ctx) {
  const { project } = ctx;

  ctx.$panel.html(`<div class="grid gap-6 lg:grid-cols-3">
    <div class="space-y-6 lg:col-span-2">${specCard(project)}${verifyTable(project)}</div>
    <div class="space-y-6">${podium(ctx, project)}${benchmarkCases(project)}</div>
  </div>`);
}
