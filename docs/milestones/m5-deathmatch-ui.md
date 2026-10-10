# M5 — Deathmatch UI

**Status:** ✅ Done · **Depends on:** M3 · **Unblocks:** M6

## Goal

The arcade experience on the static site (jQuery + Tailwind + ES modules, no new libraries):
choose a fighter, choose an arena, climb the tower one opponent at a time, watch each fight as an
animated replay of real benchmark numbers, and see the arena's rankings.

## Routes

| Route | Screen |
|-------|--------|
| `#/deathmatch` (`?fighter=rust&arena=algorithms`) | **Select**: choose your fighter, choose your arena |
| `#/deathmatch/:arena` | **Arena rankings**: standings + head-to-head matrix |
| `#/deathmatch/:arena/:fighter` | **Tower**: the fighter's ladder of opponents |
| `#/deathmatch/:arena/:fighter/:opponent` | **Fight**: animated match + commentary |

`router.js` parses/builds the route `deathmatch` with params `{ arena, fighter, opponent }`;
the view dispatches on which params are present (like the project tabs). Unknown arena or fighter
ids render the 404 page; a known fighter that does not fight in the arena gets an explanation.

## Screens

### Select — "CHOOSE YOUR FIGHTER"

```
 CHOOSE YOUR FIGHTER                                   (display font, gold/red)
 ┌──────────────────────────────┐  ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐
 │  Rs   RUST                    │  │ Go ││ Rs ││C++ ││ASM ││ Py ││ JS │   portrait grid
 │       "The Crab" · compiled   │  └────┘└────┘└────┘└────┘└────┘└────┘   (buttons, aria-pressed)
 │  Special: Borrow Checker Slam │
 │  "Fearless. Safe. Merciless." │   CHOOSE YOUR ARENA
 └──────────────────────────────┘  [The Number Pit · Algorithms · 2 projects · 6 fighters]
                                    [The Heap · Data Structures …]  [🔒 The Thread Pit — locked]
                                    [ FIGHT! ]   Arena rankings →
```

- Portrait tiles: glyph in brand color on a dark tile with a colored frame; selected tile gets a
  gold frame and a `P1` tag. Keyboard: tiles are buttons; arrow keys are not required (Tab works).
- Arena cards: stage name, category name, tagline, number of projects and fighters; locked arenas
  are disabled with the reason. Arenas where the chosen fighter cannot fight are disabled too.
- Selection is kept in the URL query (`history.replaceState`); FIGHT links to the tower.
- No spoilers: records are not shown here.

### Tower — the climb

```
 RUST · THE NUMBER PIT                     2 of 5 defeated · continues: 0
   BOSS  [C++  The Template]        🔒
         [Go   The Gopher]          ▶ FIGHT           ← next
         [JS   The Event Loop]      ✓ WIN 2–0  FATALITY
         [Py   The Serpent]         ✓ WIN 2–0  FLAWLESS
   YOU   [Rs   The Crab]
 [Fight next]  [Reveal all]  [Reset climb]  [Arena rankings]
```

- Opponents from `tournament.tower`, weakest at the bottom, boss on top; your fighter at the base.
- Step states from `progress.towerState`: watched fights show the result (win/loss/draw, score,
  fatality / flawless badges) and link to the replay; `next` shows a FIGHT button; locked steps show
  a lock and no result.
- **Game over** banner after a loss: *"GAME OVER — Continue?"* → spends a continue and unlocks the
  next opponent; or choose another fighter.
- **Champion** banner when every fight was won without continues (fighter quote); **Finished**
  banner otherwise with the record.

### Fight — the main event

```
 [Rs RUST ████████████░░░░] ●○      ROUND 2 · MEMORY · 3/4      ○○ [░░░░██████████ GO Go]
   The Crab                                                              The Gopher
             ╭────╮                                              ╭────╮
             │ Rs │  ─── lunge ──►                    -61 ✶      │ Go │   (stage: arena color glow)
             ╰────╯                                              ╰────╯
                                  FINISH THEM!                                (announcer overlay)
 ─────────────────────────────── The Number Pit ────────────────────────────────
 [⟲ Replay] [⏭ Skip] [Speed 1× | 2×]                         [Next opponent →] [Tower]
 Round 1 · Speed
   1. Rust — Uppercut · Fibonacci › Startup: 226 µs vs 919 µs (4.06× faster) · −61
   2. Go — Uppercut · Fibonacci › Throughput: 27.5 ms vs 123 ms (4.45× faster) · −65
   TIME — Go wins round 1
```

- **HUD:** health bars (green fill + a red "damage trail" that drains after a delay), names and
  nicknames, round-win medallions (gold), center label with round, theme and blow counter.
- **Stage:** arena `color` glow, stage name on the floor, two fighter sprites (glyph emblem in brand
  color) facing each other.
- **Animations (CSS keyframes):** idle bob; attacker lunge toward the opponent; hit shake + red
  flash + floating damage number; block shield flash; critical "CRITICAL" pop; K.O. fall; winner
  glow. Announcer text scales in (ROUND n, FIGHT!, FINISH THEM!, K.O., TIME, FLAWLESS VICTORY,
  FATALITY, X WINS).
- **Player** (`lib/player.js`, pure and unit-tested): plays the steps of `fight-script.js` with injected timers;
  Replay, Skip (jump to the final state), speed 1×/2×. It stops itself when the route changes.
  `prefers-reduced-motion: reduce` → no animation, the final state and the full log are shown.
- **Commentary log:** an ordered list grouped by round, appended as the fight plays (the complete
  log after Skip). Case names link to the project's benchmarks tab.
- **After the fight:** the result is recorded in the tower progress when the opponent was the
  fighter's `next` step. *Next opponent →* when the climb continues; *Continue?* after a loss;
  *Champion* when the boss falls. A fight opened directly (shared link, rankings matrix) plays
  normally and only records progress if it is the next step.
- A polite live region announces the final result ("Rust wins 2–1 by fatality") once.

### Arena rankings

- Champion card (rank 1) with quote.
- Standings table: rank, fighter, W–L–D, rounds won–lost, fatalities, flawless rounds.
- Head-to-head matrix: rows = fighter, columns = opponent; each cell "W 2–1" (green) / "L 0–2"
  (red) / "D", ☠ for a fatality, linking to that fight; it scrolls horizontally on small screens.
- Links: choose a fighter for this arena, every arena's rankings.

## Site integration

- **Nav:** Deathmatch · Projects · Leaderboard · Fighters · Methodology.
- **Home:** hero with the new name and two CTAs (*Choose your fighter* → `#/deathmatch`,
  *Browse the code* → projects); counters: fighters, open arenas, projects, last benchmark;
  **Reigning champions** strip: one card per open arena with its rank-1 fighter → arena rankings;
  the categories section becomes **Arenas** (stage + category name, project count, locked state).
- **Fighters** (`#/fighters`, replaces `#/languages`): fighter profile cards (glyph, nickname,
  special, fatality, quote) + toolchain, image, implementations, leaderboard rank, arenas won.
- **Methodology:** a "Fight rules" section (rounds, damage formula, block threshold, K.O., flawless,
  fatality, towers) — the same rules as [docs/10-deathmatch.md](../10-deathmatch.md).
- **Footer:** homage disclaimer.

## Modules

| Module | Responsibility |
|--------|----------------|
| `views/deathmatch.js` | Route dispatch and guards (no results, locked arena, fighter not in arena, no shared case) |
| `views/deathmatch-common.js` | Lookups, breadcrumbs, guard messages, scores, badges, climb load/save |
| `views/deathmatch-select.js` | Select screen |
| `views/deathmatch-tower.js` | Tower screen |
| `views/deathmatch-fight.js` | Fight screen wiring (stage, player, log, progress) |
| `views/deathmatch-fight-after.js` | Result card with the climb's next step, scorecard |
| `views/deathmatch-rankings.js` | Arena rankings |
| `views/home-deathmatch.js` | Home hero + roster, reigning champions, arenas |
| `ui/fighter.js` | Emblem, portrait, nameplate, arena title and badge HTML builders |
| `ui/fight-stage.js` | Stage/HUD markup and `render(step, { instant })` DOM updates |
| `lib/player.js` | Step playback with injected `{ setTimeout, clearTimeout }` (unit-tested) |
| `ui/storage.js` | `localStorage` adapter for `progress.js` with an in-memory fallback, every call in try/catch |
| `assets/css/deathmatch.css` | Announcer type, emblems, stage, keyframes, reduced motion (Tailwind `components` layer) |

Project pages link to their arena ("⚔ Fight in The Number Pit →").

## States

| State | Behavior |
|-------|----------|
| No `results.json` | Deathmatch screens explain how to produce results (`bin/bench.sh`); rest of the site works |
| Arena locked | Disabled on select; direct URL shows why |
| Fighter not in arena | Tower/fight URL explains the fighter has no verified implementation there |
| Storage unavailable | Climb works for the session (in-memory fallback), nothing breaks |

## Responsive & accessibility

- 360 px: portrait grid 3 × 2, stage height reduced, HUD names truncate, log below; desktop: 6 × 1.
- All controls are buttons/links with visible focus; health bars expose `role="meter"` with
  `aria-valuenow`; announcer overlay is `aria-hidden` (the log and live region carry the text).
- Contrast: display text uses gold on dark (≥ 7:1); brand colors only for glyphs (large text).

## Verification

Checked in headless Chrome (DevTools protocol) at 1366 × 900 and 360 × 780: no horizontal page
scroll on any screen, no console errors; select → tower → fight → next fight; a loss → game over →
Continue → next opponent; reveal all and reset; skip, replay, 2× speed; reduced motion opens on the
final state; navigating away mid-fight stops the player; locked arena, unknown arena and self-fight
guards; project pages, leaderboard and charts unchanged.

## Acceptance criteria

- Every route renders at 360 px and ≥ 1280 px without horizontal page scroll.
- A full climb works with the keyboard only: select → tower → fight → next → … → champion /
  game over → continue.
- Reduced motion shows the final state instantly; Skip and Replay work mid-fight; navigating away
  mid-fight stops the player (no errors in the console).
- Router tests cover the new routes; `npm test` green.
