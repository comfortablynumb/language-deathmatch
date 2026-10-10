/* Project tab: Code (one implementation at a time). */
import * as format from '../lib/format.js';
import * as router from '../lib/router.js';
import * as c from '../ui/components.js';
import * as codeView from '../ui/code.js';
import * as shared from './shared.js';

const e = format.escapeHtml;

/** Implementation for a language id, falling back to the first one. */
export function pickImplementation(project, language) {
  return project.implementations.find((i) => i.language === language) || project.implementations[0];
}

function languagePills(ctx, selected) {
  const { project, catalog } = ctx;
  const pills = project.implementations.map((impl) => {
    const language = catalog.languages.find((l) => l.id === impl.language);
    const href = router.build('project', { id: project.id, tab: 'code', a: impl.language });
    return `<a class="pill" role="tab" aria-selected="${impl.language === selected}" href="${href}">${c.langDot(language)}${e(language.name)}</a>`;
  }).join('');

  return `<div class="flex flex-wrap gap-2" role="tablist" aria-label="Languages">${pills}</div>`;
}

function verificationSummary(result) {
  if (!result) {
    return '<span class="chip">not benchmarked yet</span>';
  }

  const passed = result.verification.filter((v) => v.passed).length;
  return c.statusBadge(result.status === 'ok', `${result.status === 'ok' ? 'verified' : 'failed'} · ${passed}/${result.verification.length} cases`);
}

/** Header card with toolchain, metrics and notes of an implementation. */
function implementationCard(ctx, impl) {
  const language = ctx.catalog.languages.find((l) => l.id === impl.language);
  const result = shared.resultFor(ctx, ctx.project, impl.language);
  const image = result && result.image.sizeBytes ? format.bytes(result.image.sizeBytes) : '–';
  const notes = impl.notes.map((n) => `<li>${e(n)}</li>`).join('');

  return `<section class="card p-5 sm:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="flex items-center gap-2.5 text-xl font-semibold">${c.langDot(language)}${e(language.name)}
        <span class="chip">${e(language.kind)}</span></h2>
      ${verificationSummary(result)}
    </div>
    <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      ${c.statTile('Toolchain', language.toolchain)}
      ${c.statTile('Lines of code', impl.loc, 'non-blank, source files')}
      ${c.statTile('Files', impl.files.length)}
      ${c.statTile('Image size', image, language.image)}
    </div>
    ${notes ? `<div class="prose-ldm mt-5 text-sm"><ul>${notes}</ul></div>` : ''}
  </section>`;
}

export function code(ctx) {
  const impl = pickImplementation(ctx.project, ctx.route.params.a);

  ctx.$panel.html(`${languagePills(ctx, impl.language)}
    <div class="mt-6 space-y-6">${implementationCard(ctx, impl)}${codeView.viewer(impl.files)}</div>`);
  codeView.mount(ctx.$panel, [impl.files]);
}
