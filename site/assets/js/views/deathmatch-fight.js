/* Deathmatch fight: the animated replay of one match (stage + commentary), then the scorecard and
   what comes next in the fighter's climb. */
import * as format from '../lib/format.js';
import * as router from '../lib/router.js';
import * as progress from '../lib/progress.js';
import { playMatch } from '../lib/fight.js';
import { fightScript } from '../lib/fight-script.js';
import { createPlayer } from '../lib/player.js';
import { outcomeFor } from '../lib/tournament.js';
import { stageHtml, createStage } from '../ui/fight-stage.js';
import * as c from '../ui/components.js';
import * as common from './deathmatch-common.js';
import { scorecard, afterFight } from './deathmatch-fight-after.js';

const e = format.escapeHtml;
const SPEEDS = [{ id: '1', label: '1×' }, { id: '2', label: '2×' }];
const session = { speed: 1 };

function reducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function logItem(step, languages) {
  if (step.kind === 'round') {
    return `<li class="pt-3 font-display text-xl tracking-wide text-gold uppercase first:pt-0">${e(step.log)}</li>`;
  }

  if (step.kind === 'blow') {
    const color = step.side ? languages[step.side].color : '#8a91a0';
    const href = router.build('project', { id: step.project, tab: 'benchmarks' }, { case: step.caseId });
    return `<li class="flex gap-2"><span class="lang-dot mt-1.5" style="--lang-color:${e(color)}" aria-hidden="true"></span>
      <span>${e(step.log)} <a class="text-ink-3 hover:text-accent" href="${href}" title="Benchmark data">↗</a></span></li>`;
  }

  return `<li class="font-semibold text-ink">${e(step.log)}</li>`;
}

function layout(ctx, fight) {
  const { arena, languages } = fight;
  const crumbs = [...common.arenaCrumbs(arena), { label: `${languages.a.name}'s tower`, href: common.link({ arena: arena.id, fighter: languages.a.id }) },
    { label: `vs ${languages.b.name}` }];

  return `${common.breadcrumb(crumbs)}
    <h1 class="sr-only">${e(languages.a.name)} versus ${e(languages.b.name)} in ${e(arena.category.arena.stage)}</h1>
    <div class="mt-5">${stageHtml(arena.category, languages)}</div>
    <div class="mt-4 flex flex-wrap items-center gap-2">
      <button type="button" class="pill" data-replay>⟲ Replay</button>
      <button type="button" class="pill" data-skip>⏭ Skip to the result</button>
      ${c.segmented('speed', SPEEDS, String(session.speed), 'Playback speed')}
    </div>
    <p class="sr-only" role="status" aria-live="polite" id="fight-status"></p>
    <div class="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section class="card p-5"><h2 class="font-display text-2xl tracking-wide uppercase">Blow by blow</h2>
        <ol id="fight-log" class="mt-3 max-h-[28rem] space-y-1.5 overflow-y-auto pr-1 text-sm text-ink-2"></ol></section>
      <div id="fight-after" class="space-y-6"></div>
    </div>`;
}

/** Records the fight in the climb (only if it was the next one) and shows what comes next. */
function complete(ctx, fight) {
  const before = common.climbOf(ctx, fight.arena, fight.languages.a.id);
  const climb = common.saveClimb(ctx, before, progress.recordFight(before.tower, before.state.progress, fight.languages.b.id));
  const summary = fight.steps[fight.steps.length - 1].summary;
  ctx.$root.find('#fight-status').text(`${summary}.`);
  ctx.$root.find('#fight-after').html(`${afterFight(ctx, fight, climb)}${scorecard(fight)}`);
}

function bindControls(ctx, fight, controls) {
  ctx.$root.on('click', '[data-replay]', () => {
    controls.log.empty();
    ctx.$root.find('#fight-after').empty();
    controls.player.play();
  });
  ctx.$root.on('click', '[data-skip]', () => controls.skip());
  ctx.$root.on('click', '[data-speed]', function () {
    session.speed = Number($(this).attr('data-speed'));
    controls.player.setSpeed(session.speed);
    controls.stage.setSpeed(session.speed);
    ctx.$root.find('[data-speed]').attr('aria-pressed', function () { return String(Number($(this).attr('data-speed')) === session.speed); });
  });
  ctx.$root.on('click', '[data-continue]', () => {
    const climb = common.climbOf(ctx, fight.arena, fight.languages.a.id);
    const next = common.saveClimb(ctx, climb, progress.spendContinue(climb.tower, climb.state.progress)).state.next;
    location.hash = next ? common.link({ arena: fight.arena.id, fighter: fight.languages.a.id, opponent: next.language })
      : common.link({ arena: fight.arena.id, fighter: fight.languages.a.id });
  });
}

function start(ctx, fight) {
  const $log = ctx.$root.find('#fight-log');
  const stage = createStage(ctx.$root.find('[data-stage]')[0]);
  const player = createPlayer(fight.steps, {
    timers: window,
    isActive: ctx.isCurrent,
    onStep: (step) => {
      stage.render(step);
      $log.append(step.log ? logItem(step, fight.languages) : '');
      $log.scrollTop($log[0].scrollHeight);
    },
    onComplete: () => complete(ctx, fight),
  });
  const skip = () => {
    stage.render(fight.steps[fight.steps.length - 1], { instant: true });
    $log.html(fight.steps.filter((s) => s.log).map((s) => logItem(s, fight.languages)).join(''));
    player.skip();
  };

  player.setSpeed(session.speed);
  stage.setSpeed(session.speed);
  bindControls(ctx, fight, { log: $log, player, stage, skip });

  if (reducedMotion()) {
    skip();
  } else {
    player.play();
  }
}

/** Renders the fight between two languages of an arena (both able to fight there). */
export function fightView(ctx, arena, fighter, opponent) {
  const languages = { a: fighter, b: opponent };
  const match = playMatch(arena, fighter.id, opponent.id);
  const fight = { arena, languages, match, steps: fightScript(match, languages), outcome: outcomeFor(match, fighter.id) };

  document.title = format.pageTitle(`${fighter.name} vs ${opponent.name}`, arena.category.arena.stage);
  ctx.$root.html(layout(ctx, fight));
  start(ctx, fight);
}
