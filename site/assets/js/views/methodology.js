/* Methodology: how results are produced (mirrors docs/05-benchmarking.md) and how fights are scored. */
import * as format from '../lib/format.js';
import * as c from '../ui/components.js';
import * as shared from './shared.js';

const CONTENT = `
  <h2>Pipeline</h2>
  <p>For every implementation the CI builds its Docker image (<code>FROM</code> the language's pinned toolchain image), runs every
    <b>verification case</b> with <code>docker run --network none</code> and compares the exit code and stdout byte for byte (exact text or
    SHA-256). Only implementations that pass all cases are benchmarked.</p>
  <h2>Harness</h2>
  <p>Benchmarks run <b>inside</b> the container, so <code>docker run</code> overhead is never measured. A read-only mount provides two tools:</p>
  <ul>
    <li><code>ldmmeasure</code> (Go) runs the protocol: one verification run whose stdout is hashed, warmup runs, timed runs and memory runs.</li>
    <li><code>ldmexec</code> (a small static C launcher) forks the program, waits for it with <code>wait4</code> and reports wall time, user/system CPU
      time and peak memory. Forking from a tiny process keeps the memory numbers free of the harness's own footprint.</li>
  </ul>
  <h2>Metrics</h2>
  <ul>
    <li><b>Wall time</b> — monotonic clock from fork to exit, per timed run (stdout to <code>/dev/null</code>).</li>
    <li><b>CPU time</b> — user + system time of the process.</li>
    <li><b>Peak memory</b> — measured in separate, untimed memory runs: the program is traced, stopped right before it exits and its exact resident
      set is read from <code>/proc/&lt;pid&gt;/smaps_rollup</code>; the reported value is the maximum of that and the kernel's <code>ru_maxrss</code>.
      (Since Linux 6.2 the kernel's RSS counters are per-CPU approximations that read tiny programs as 0 KiB.)</li>
    <li><b>Lines of code</b> — non-blank lines of the source files. <b>Image size</b> — size of the final Docker image.</li>
  </ul>
  <h2>Statistics</h2>
  <ul>
    <li>The <b>median</b> is the headline number; box plots show quartiles, min and max, and every individual run.</li>
    <li>No outlier removal: all samples are published in <code>results.json</code>.</li>
    <li>Relative factor = median ÷ best median of the same case. Leaderboard score = geometric mean of a language's factors.</li>
  </ul>
  <h2>Fairness rules</h2>
  <ul>
    <li>Same spec, same algorithm, same verification, same harness for every language.</li>
    <li>Idiomatic code with the standard library; release builds with each language's customary flags.</li>
    <li>All implementations of one run are measured sequentially on the same machine; runs are never mixed.</li>
    <li>Containers run with <code>--network none</code> and are pinned to one CPU in CI.</li>
  </ul>`;

/* Mirrors docs/10-deathmatch.md and the constants of lib/fight.js. */
const FIGHT_RULES = `
  <h2 id="fight-rules" class="scroll-mt-24">Fight rules</h2>
  <p>A fight is a dramatized, deterministic replay of the published results: the same <code>results.json</code> always produces the
    same fights. An <b>arena</b> is a project category; only implementations that passed verification fight.</p>
  <ul>
    <li><b>Best of three rounds.</b> Round 1 <b>Speed</b>: one blow per benchmark case both fighters completed, on median wall time.
      Round 2 <b>Memory</b>: the same cases on median peak memory. Round 3 <b>Brevity</b> (only at 1–1): per project, lines of code.
      Image size is not scored: it is the same for every project of a language, so it would decide every arena the same way.</li>
    <li><b>Blows.</b> The lower value attacks. Damage = 50 × log₂(slower ÷ faster) ÷ number of blows in the round, at least 1 and at
      most 100; ratios under <b>1.05×</b> are measurement noise and are <b>blocked</b>. A fighter 2× worse on every comparison of a
      round loses 50 health; 4× worse is knocked out.</li>
    <li><b>Rounds.</b> Both fighters start each round at 100 health; the one who took less damage wins it — a <b>K.O.</b> when the
      loser has no health left, on <b>time</b> otherwise. Taking no damage at all is a <b>flawless victory</b>. Because damage is
      proportional to the logarithm of the ratio, the round goes to the fighter that is better on the geometric mean of the ratios —
      the same statistic as the leaderboard (up to the per-blow cap, rounding and blocks).</li>
    <li><b>Match.</b> First to two round wins. Tied round wins (drawn rounds) go to the fighter with more health left over all rounds,
      otherwise the match is a draw. A <b>fatality</b> is a final-round K.O. finished by a blow of 10× or more.</li>
    <li><b>Towers and rankings.</b> In each arena every pair fights once; the standings rank wins, losses, round difference and
      fatalities. A fighter's tower holds every opponent, weakest first, so the arena's strongest other fighter is the final boss.
      Your progress in a tower is stored only in your browser.</li>
  </ul>`;

export function render(ctx) {
  document.title = format.pageTitle('Methodology');
  const env = ctx.results
    ? c.panel('Latest run', 'Environment of the published results.', shared.environmentCard(ctx.results))
    : c.panel('Latest run', '', '<p class="text-sm text-ink-3">No benchmark results yet.</p>');

  ctx.$root.html(`<div class="grid gap-10 lg:grid-cols-[1fr_340px]">
    <article class="prose-ldm max-w-3xl">
      <h1 class="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Methodology</h1>
      <p class="mt-2">How every number on this site is produced. Everything runs from pinned Docker images, so you can reproduce it
        locally with <code>bin/bench.sh</code>.</p>
      ${CONTENT}${FIGHT_RULES}
    </article>
    <aside class="lg:pt-16">${env}</aside>
  </div>`);

  if (ctx.route.query.section) {
    const target = document.getElementById(ctx.route.query.section);

    if (target) {
      target.scrollIntoView();
    }
  }
}
