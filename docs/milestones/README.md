# Language Deathmatch — Milestones

**Language Wars becomes Language Deathmatch**: a fighting-game take on the same idea. You
**choose a fighter** (a language), **choose an arena** (a type of problem: a project category)
and your fighter **climbs a tower, fighting every other language one after another**. Every
blow is a real benchmark number: the same programs, verified byte for byte and measured in
Docker. Nothing is random and nothing is invented: a fight is a dramatized, deterministic
replay of `results.json`.

## Game mapping

| Fighting game | Language Deathmatch | Source of truth |
|---------------|---------------------|-----------------|
| Fighter | A language (+ a fighter profile: glyph, nickname, special move, fatality, quote) | `catalog/languages.json` |
| Arena / stage | A project category (+ a stage name, tagline, color) | `catalog/categories.json` |
| Match | Fighter A vs fighter B in one arena, best of 3 rounds | computed in the browser |
| Round 1 · Speed | One blow per benchmark case: median wall time | `results.json` |
| Round 2 · Memory | One blow per benchmark case: median peak memory | `results.json` |
| Round 3 · Brevity (only if 1–1) | One blow per project: lines of code | `catalog.json` |
| Damage | Grows with how many times better the attacker was (log scale) | [M3](m3-fight-engine.md) |
| K.O. / Flawless / Fatality | Health reaches 0 / round won untouched / final K.O. by a ≥ 10× blow | [M3](m3-fight-engine.md) |
| Tower (arcade ladder) | Every other fighter of the arena, weakest first, the arena's strongest as the boss | [M3](m3-fight-engine.md) |
| Kombat rankings | Round-robin of every pair in an arena: standings + head-to-head matrix | [M3](m3-fight-engine.md) |

## Milestones

| # | Milestone | Outcome | Depends on | Status |
|---|-----------|---------|------------|--------|
| M1 | [Rebrand](m1-rebrand.md) | Every name, tool, image tag, token, logo and doc says Language Deathmatch | — | ✅ |
| M2 | [Fighters & arenas in the catalog](m2-fighters-and-arenas.md) | Fighter and arena profiles validated by `ldm catalog`; site data carries what fights need | M1 | ✅ |
| M3 | [Fight engine](m3-fight-engine.md) | Pure, unit-tested JS: arenas, blows, rounds, matches, standings, towers, progress, fight script | M2 | ✅ |
| M4 | [Arena roster](m4-arena-roster.md) | Four new projects × six languages so four arenas are open | M1 | ✅ |
| M5 | [Deathmatch UI](m5-deathmatch-ui.md) | Fighter/arena select, tower, animated fight, arena rankings, home + nav integration | M3 | ✅ |
| M6 | [Launch](m6-launch.md) | Full benchmark run, browser QA, README / CLAUDE.md / docs in sync, all tests green | M4, M5 | ✅ |
| M7 | [New fighters: C, Zig, V, Java, Haskell](m7-new-fighters.md) | Five more languages in every arena: 25 new implementations, profiles, highlighting | M6 | ✅ |

M4 (implementations in Docker) and M5 (website) are independent and can run in parallel once
M3 has fixed the data contract.

## Principles carried over

1. **Real numbers only.** Every blow cites the two measured values it comes from. A language
   without an implementation (or with a failed one) simply does not fight in that arena.
2. **Deterministic.** The same `results.json` always produces the same fights, so fight URLs
   are shareable (`#/deathmatch/algorithms/rust/go`).
3. **Explainable.** The rules fit on one page (the site's Methodology page and
   [docs/10-deathmatch.md](../10-deathmatch.md)); a round always goes to the fighter that is better
   on the geometric mean of ratios — the same statistic as the leaderboard.
4. **Same engineering rules.** Pure logic in `site/assets/js/lib/` with `node --test` coverage;
   functions ≤ 50 lines, ≤ 4 parameters; every dependency (storage, timers, data) injected.

## Definition of done (whole effort)

- `bin/test.sh` green (Go + JS), `bin/build.sh` green, `bin/bench.sh -verify-only` green for every
  implementation, a full `bin/bench.sh` run published to `site/data/results.json`.
- Every screen of [M5](m5-deathmatch-ui.md) works at 360 px and desktop widths, with keyboard only,
  and with `prefers-reduced-motion`.
- No reference to the old name outside generated files.
