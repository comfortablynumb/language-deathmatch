/* Fight stage: HUD (health bars, round medallions, round label), two fighter sprites and the
   announcer overlay. stageHtml() builds the markup; createStage() renders fight-script steps. */
import * as format from '../lib/format.js';
import { emblem, arenaStyle } from './fighter.js';

const e = format.escapeHtml;
const SIDES = ['a', 'b'];
const ANNOUNCED = new Set(['intro', 'round', 'fight', 'finish', 'round-end', 'fatality', 'result']);
const MEDALS = 2;
const LOW_HEALTH = 30;

function hudSide(language, side) {
  const medals = '<span class="medal"></span>'.repeat(MEDALS);

  return `<div class="hud-side ${side === 'a' ? 'left' : 'right'}" data-hud="${side}">
    <div class="hp" role="meter" aria-label="${e(language.name)} health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
      <div class="hp-trail" style="width:100%"></div><div class="hp-fill" style="width:100%"></div>
    </div>
    <div class="hud-name">${e(language.name)}</div>
    <div class="hud-nick">${e(language.fighter.nickname)}</div>
    <div class="medals" role="img" aria-label="Rounds won: 0">${medals}</div>
  </div>`;
}

function sprite(language, side) {
  return `<div class="sprite ${side === 'a' ? 'left' : 'right'}" data-sprite="${side}">
    <div class="sprite-inner"><div class="sprite-body">${emblem(language, 'xl')}</div></div>
    <div class="sprite-shadow"></div>
  </div>`;
}

/** Stage markup for a match in an arena; languages = { a, b }. */
export function stageHtml(category, languages) {
  return `<div class="stage" style="${arenaStyle(category)}" data-stage>
    <div class="hud">${hudSide(languages.a, 'a')}
      <div class="hud-center"><div class="hud-round" data-round>VS</div><div class="hud-meta" data-meta></div></div>
      ${hudSide(languages.b, 'b')}</div>
    <div class="arena-floor">${sprite(languages.a, 'a')}${sprite(languages.b, 'b')}</div>
    <div class="move-name" data-move aria-hidden="true"></div>
    <div class="announcer" data-announcer aria-hidden="true">
      <div class="announcer-text dm-title" data-announce-text></div><div class="announcer-sub" data-announce-sub></div>
    </div>
    <div class="stage-name" aria-hidden="true">${e(category.arena.stage)}</div>
  </div>`;
}

/** Restarts a CSS animation class on an element. */
function replay(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function findParts(stage) {
  const pick = (selector) => stage.querySelector(selector);
  const side = (s) => ({
    hud: pick(`[data-hud="${s}"]`),
    meter: pick(`[data-hud="${s}"] .hp`),
    fill: pick(`[data-hud="${s}"] .hp-fill`),
    trail: pick(`[data-hud="${s}"] .hp-trail`),
    medals: pick(`[data-hud="${s}"] .medals`),
    sprite: pick(`[data-sprite="${s}"]`),
  });

  return {
    stage, a: side('a'), b: side('b'), round: pick('[data-round]'), meta: pick('[data-meta]'), move: pick('[data-move]'),
    announcer: pick('[data-announcer]'), text: pick('[data-announce-text]'), sub: pick('[data-announce-sub]'),
  };
}

function updateHud(parts, step) {
  for (const s of SIDES) {
    const health = step.health[s];
    parts[s].fill.style.width = `${health}%`;
    parts[s].trail.style.width = `${health}%`;
    parts[s].fill.classList.toggle('low', health < LOW_HEALTH);
    parts[s].meter.setAttribute('aria-valuenow', String(health));
    parts[s].medals.setAttribute('aria-label', `Rounds won: ${step.wins[s]}`);
    parts[s].medals.querySelectorAll('.medal').forEach((medal, i) => medal.classList.toggle('won', i < step.wins[s]));
  }

  parts.round.textContent = step.round === null ? 'VS' : `R${step.round + 1}`;
  parts.meta.textContent = step.kind === 'blow' ? `${step.blowIndex} / ${step.blowCount}` : '';
}

/** Sprite poses that hold across steps: knocked down, winner, and the fatality vignette. */
function updatePoses(parts, step) {
  const winner = step.kind === 'result' ? step.side : null;

  for (const s of SIDES) {
    parts[s].sprite.classList.toggle('ko', step.down === s);
    parts[s].sprite.classList.toggle('winner', winner === s);
  }

  parts.stage.classList.toggle('fatality', step.fatality);
}

function popText(sprite, text, tone) {
  const pop = document.createElement('span');
  pop.className = `damage-pop ${tone}`;
  pop.textContent = text;
  pop.addEventListener('animationend', () => pop.remove());
  sprite.append(pop);
}

/** One blow: lunge, hit or block, damage number, move name, screen shake on critical hits. */
function animateBlow(parts, step) {
  parts.move.textContent = step.move;
  replay(parts.move, 'show');

  if (step.blocked) {
    SIDES.forEach((s) => replay(parts[s].sprite, 'block'));
    popText(parts.b.sprite, 'Blocked', 'blocked');
    return;
  }

  const defender = step.side === 'a' ? 'b' : 'a';
  replay(parts[step.side].sprite, 'attack');
  replay(parts[defender].sprite, 'hit');
  popText(parts[defender].sprite, `−${step.damage}`, step.critical ? 'critical' : '');

  if (step.critical) {
    replay(parts.stage, 'shake');
  }
}

function announce(parts, step, ctx) {
  parts.text.textContent = step.text;
  parts.sub.textContent = step.sub;
  parts.announcer.classList.toggle('blood', step.kind === 'fatality' || step.kind === 'finish');
  parts.announcer.classList.remove('show', 'hold');

  if (step.kind === 'result') {
    replay(parts.announcer, 'hold');
  } else if (!ctx.instant) {
    parts.announcer.style.setProperty('--announce-ms', `${Math.round(step.duration / ctx.speed)}ms`);
    replay(parts.announcer, 'show');
  }
}

/** Returns { render(step, { instant }), setSpeed(speed) } for the stage element. */
export function createStage(stage) {
  const parts = findParts(stage);
  let speed = 1;

  return {
    render(step, options = {}) {
      const instant = Boolean(options.instant);
      parts.stage.classList.toggle('instant', instant);
      updateHud(parts, step);
      updatePoses(parts, step);

      if (ANNOUNCED.has(step.kind)) {
        announce(parts, step, { instant, speed });
      } else if (!instant) {
        animateBlow(parts, step);
      }
    },
    setSpeed(value) {
      speed = value;
      parts.stage.style.setProperty('--speed', String(value));
    },
  };
}
