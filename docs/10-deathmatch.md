# 10. Deathmatch

The game layer of the site: **choose a fighter** (a language), **choose an arena** (a project
category) and **climb a tower**, fighting every other language of that arena one after another.
A fight is a dramatized, deterministic replay of `results.json`: the same results always produce
the same fights, and every blow cites the two measured values it comes from.

The plan that built it lives in [milestones/](milestones/README.md).

## Concepts

| Concept | What it is | Source |
|---------|------------|--------|
| Fighter | A language with its fighter profile (glyph, nickname, special move, fatality, quote) | `catalog/languages.json` |
| Arena | A project category with its arena profile (stage, tagline, color) | `catalog/categories.json` |
| Arena data | Per benchmark case: every fighter's median wall time, CPU time, peak memory; per project: lines of code | `results.json` + `catalog.json` |
| Match | Two fighters, best of three rounds | `lib/fight.js` |
| Standings | Round-robin of every pair of an arena | `lib/tournament.js` |
| Tower | A fighter's opponents in an arena, weakest first, the strongest last (the boss) | `lib/tournament.js` |
| Climb | The viewer's progress in a tower (browser storage) | `lib/progress.js` |

Only implementations whose result has `status: ok` fight; a case result must be `ok` too. An arena
is **open** when at least two fighters have results in it, otherwise **locked** (no project yet,
or not enough fighters). Two fighters can fight when they share at least one benchmark case.

## Rules of combat

### Rounds

| # | Round | One blow per… | Lower value wins |
|---|-------|---------------|------------------|
| 1 | **Speed** | benchmark case both fighters completed | median wall time |
| 2 | **Memory** | benchmark case both fighters completed | median peak memory |
| 3 | **Brevity** (only if needed) | project both fighters completed | lines of code |

Rounds are played in order until a fighter has two round wins.

Image size is deliberately not a round: it is a property of the toolchain, identical for every
project of a language, so it would push the same verdict in every arena. (The first version had a
*Footprint* round with image size; with real results it made all four arenas rank the fighters in
the same order, which defeated the point of choosing an arena.)

### Blows

For one comparison with values `x` and `y` (both > 0; otherwise there is no blow):

```
factor = max(x, y) / min(x, y)          the lower value attacks
factor < 1.05            → blocked, no damage (measurement noise)
damage = clamp(round(50 × log2(factor) / n), 1, 100)      n = comparisons in the round
```

Each round distributes the same power whatever the number of cases: a fighter 2× worse on every
comparison of a round loses 50 health, 4× worse is knocked out.

| Factor | Move |
|--------|------|
| < 1.05 | Block |
| < 1.5 | Jab |
| < 2.5 | Kick |
| < 5 | Uppercut |
| < 10 | the attacker's special move |
| ≥ 10 | the attacker's special move, **critical** |
| finishing blow of a fatality | the attacker's fatality |

### Rounds, matches, fatalities

- Both fighters start each round at **100 health** (`health = max(0, 100 − damage taken)`).
- The fighter who **took less damage** wins the round; equal damage is a draw. **K.O.** when the
  loser's health is 0, **time** otherwise. **Flawless victory**: the winner took no damage.
- Damage is proportional to `log(factor)`, so a round goes to the fighter that is better on the
  **geometric mean of the ratios** — the leaderboard's statistic — up to the per-blow cap,
  rounding, the 1-point minimum and blocks.
- **Match**: first to two round wins. Tied round wins (because of drawn rounds) go to the fighter
  with more health left over all rounds; otherwise the match is a **draw**.
- **Finishing blow**: in a won round, the blow that dealt the most damage to the loser (the later
  one on ties); it is played last.
- **Fatality**: the match winner knocked the loser out in the last round played and the finishing
  blow was critical (≥ 10×).
- Matches are symmetric: swapping the fighters mirrors every round and blow.

### Standings and towers

- **Standings**: every pair that can fight meets once. Sorted by wins ↓, losses ↑, round difference
  ↓, fatalities ↓, catalog order. Columns: W–L(–D), rounds won–lost, fatalities, flawless rounds.
- **Tower**: every opponent the fighter can meet, ordered by standings rank from the bottom of the
  table up, so the arena's strongest other fighter is the final boss.

### Climbing (per viewer)

Progress lives in the viewer's browser (`localStorage` key `ldm:tower:<arena>:<fighter>`, value
`{ "watched": ["python", "go"], "continues": 0 }`), with an in-memory fallback when storage is
unavailable. Stored ids that do not follow the current tower order are dropped, so new results
never break a climb.

| Step state | Meaning |
|------------|---------|
| `won` / `lost` / `draw` | watched; the result is revealed |
| `next` | the next fight of the climb |
| `locked` | not reachable yet (also the next step during a game over) |

| Status | When |
|--------|------|
| `ready` | nothing watched |
| `climbing` | the last watched fight was won, or a continue was spent on the loss |
| `game-over` | the last watched fight was not a win and no continue was spent on it |
| `champion` | every fight watched and won |
| `finished` | every fight watched, at least one not won |

Watching a fight records it only when it is the climb's `next` step; any other fight (a shared
link, a rankings cell) is an *exhibition match*. After a loss, **Continue?** spends a continue and
unlocks the next opponent. **Reveal all** marks the whole tower watched; **Reset** clears it.

## Screens and routes

| Route | Screen | View module |
|-------|--------|-------------|
| `#/deathmatch?fighter=&arena=` | Choose your fighter / arena | `views/deathmatch-select.js` |
| `#/deathmatch/:arena` | Arena rankings: champion, standings, head-to-head matrix | `views/deathmatch-rankings.js` |
| `#/deathmatch/:arena/:fighter` | Tower | `views/deathmatch-tower.js` |
| `#/deathmatch/:arena/:fighter/:opponent` | Fight: stage, controls, blow-by-blow log, result, scorecard | `views/deathmatch-fight.js` (+ `-fight-after.js`) |
| `#/fighters` | Fighter profiles, arena titles | `views/pages.js` |

`views/deathmatch.js` dispatches the route and renders explanations for locked arenas, fighters
without results in an arena, pairs without a shared case and a missing `results.json`.

### The fight player

`lib/fight-script.js` turns a match into steps — `intro`, `round`, `fight`, `blow`, `finish`
(FINISH THEM!), `round-end` (K.O. / TIME / DRAW), `fatality`, `result` — each carrying the health of
both fighters after it, the round wins, who is down, a commentary line and a base duration.
`lib/player.js` plays them with injected timers (1× / 2×, Replay, Skip) and stops when the route
changes; `ui/fight-stage.js` renders a step into the HUD, sprites and announcer. Displayed health
never shows 0 for a round's winner, and a knocked-out loser stays at ≥ 1 until the finishing blow.
With `prefers-reduced-motion: reduce` the fight opens on its final state with the full log.

## Data the site needs

Nothing beyond the two documents loaded at startup: `catalog.json` (languages with `fighter`,
categories with `arena`, projects with `benchmarks` and `loc`) and `results.json`.

## Code

| Module | Responsibility | Tests |
|--------|----------------|-------|
| `lib/arena.js` | Arena data, open/locked, `canFight` | `tests/site/arena.test.js` |
| `lib/fight.js` | Blows, damage, moves, rounds, matches | `tests/site/fight.test.js` |
| `lib/tournament.js` | Round-robin, standings, towers, outcomes | `tests/site/tournament.test.js` |
| `lib/progress.js` | Climb state over injected storage | `tests/site/progress.test.js` |
| `lib/fight-script.js` | Steps, displayed health, commentary | `tests/site/fight-script.test.js` |
| `lib/player.js` | Step playback with injected timers | `tests/site/player.test.js` |
| `ui/fighter.js`, `ui/fight-stage.js`, `ui/storage.js` | Emblems, stage rendering, storage adapter | — (DOM) |
| `assets/css/deathmatch.css` | Announcer type, emblems, stage, animations, reduced motion | — |
