/* Home page assembly and explorer interactions (filters live in the URL query). */
import * as format from '../lib/format.js';
import * as filters from '../lib/filters.js';
import * as c from '../ui/components.js';
import * as shared from './shared.js';
import * as parts from './home.js';
import * as dm from './home-deathmatch.js';

const e = format.escapeHtml;

function options(items, selected, allLabel) {
  const list = [{ value: '', label: allLabel }, ...items];
  return list.map((o) => `<option value="${e(o.value)}" ${o.value === selected ? 'selected' : ''}>${e(o.label)}</option>`).join('');
}

function controls(ctx, criteria) {
  const { catalog } = ctx;
  const categories = catalog.categories.map((cat) => ({ value: cat.id, label: cat.name }));
  const languages = catalog.languages.map((l) => ({ value: l.id, label: l.name }));
  const levels = [{ id: '', label: 'All levels' }, ...catalog.levels.map((l) => ({ id: String(l.level), label: `${l.level} · ${l.name}` }))];

  return `<div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
      <label class="sr-only" for="f-q">Search projects</label>
      <input id="f-q" class="field" type="search" placeholder="Search projects, tags…" value="${e(criteria.q)}" autocomplete="off">
      <label class="sr-only" for="f-cat">Category</label>
      <select id="f-cat" class="field">${options(categories, criteria.category, 'All categories')}</select>
      <label class="sr-only" for="f-lang">Language</label>
      <select id="f-lang" class="field">${options(languages, criteria.language, 'Any language')}</select>
      <label class="sr-only" for="f-sort">Sort</label>
      <select id="f-sort" class="field">${options([{ value: 'name', label: 'Sort by name' }], criteria.sort, 'Sort by level')}</select>
    </div>
    <div class="mt-3">${c.segmented('level', levels, criteria.level, 'Complexity level')}</div>`;
}

function grid(ctx, criteria) {
  const found = filters.sortProjects(filters.filterProjects(ctx.catalog.projects, criteria), criteria.sort);

  if (!found.length) {
    return `<div class="sm:col-span-2 lg:col-span-3">${c.emptyState('No project matches', 'Try another search or clear the filters.')}</div>`;
  }

  return found.map((p) => parts.projectCard(ctx, p)).join('');
}

function criteriaFrom(query) {
  return { q: query.q || '', category: query.cat || '', level: query.level || '', language: query.lang || '', sort: query.sort || '' };
}

export function render(ctx) {
  const criteria = criteriaFrom(ctx.route.query);

  ctx.$root.html(`${dm.hero(ctx)}${dm.championsSection(ctx)}
    <section class="mt-14 scroll-mt-20" id="projects">
      <div class="flex flex-wrap items-end justify-between gap-2">
        ${c.sectionTitle('Projects', 'Pick a project to read the implementations and compare their benchmarks.')}
        <span id="project-count" class="text-sm text-ink-3"></span>
      </div>
      ${controls(ctx, criteria)}
      <div id="project-grid" class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"></div>
    </section>
    ${dm.arenasSection(ctx)}`);

  bind(ctx, criteria);
  refresh(ctx, criteria);
}

function refresh(ctx, criteria) {
  const count = filters.filterProjects(ctx.catalog.projects, criteria).length;
  ctx.$root.find('#project-grid').html(grid(ctx, criteria));
  ctx.$root.find('#project-count').text(`${count} of ${format.plural(ctx.catalog.projects.length, 'project')}`);
  ctx.$root.find('[data-level]').attr('aria-pressed', function () { return String($(this).attr('data-level') === criteria.level); });
  shared.replaceQuery(ctx.route, { q: criteria.q, cat: criteria.category, level: criteria.level, lang: criteria.language, sort: criteria.sort });
}

function bind(ctx, criteria) {
  const $root = ctx.$root;
  let timer = null;
  const update = (changes) => refresh(ctx, Object.assign(criteria, changes));

  $root.on('input', '#f-q', function () {
    clearTimeout(timer);
    timer = setTimeout(() => update({ q: this.value }), 120);
  });
  $root.on('change', '#f-cat', function () { update({ category: this.value }); });
  $root.on('change', '#f-lang', function () { update({ language: this.value }); });
  $root.on('change', '#f-sort', function () { update({ sort: this.value }); });
  $root.on('click', '[data-level]', function () { update({ level: $(this).attr('data-level') }); });
  $root.on('click', '[data-scroll]', function () {
    document.getElementById($(this).attr('data-scroll')).scrollIntoView({ behavior: 'smooth' });
  });
  $root.on('click', '[data-category]', function () {
    update({ category: $(this).attr('data-category') });
    $root.find('#f-cat').val(criteria.category);
    document.getElementById('projects').scrollIntoView({ behavior: 'smooth' });
  });
}
