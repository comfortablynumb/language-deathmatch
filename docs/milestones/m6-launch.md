# M6 — Launch

**Status:** ✅ Done · **Depends on:** M4, M5

## Goal

Ship it: real numbers for every arena, a site checked in a real browser, and documentation that
matches the code.

## Tasks

- [x] Full local run: `bin/bench.sh` (all five projects × six languages) → `site/data/results.json`;
      `bin/build.sh`.
- [x] Sanity-check the fights against the numbers: spot-check a few matches by hand (damage
      formula, round winners vs geometric means), make sure no arena produces degenerate results
      (all draws, everyone K.O.'d in every round).
- [x] Browser QA (Chrome), desktop and 360 px:
  - home, projects, project tabs, leaderboard, fighters, methodology still work;
  - select → tower → fight → next → … → champion; a loss → game over → continue;
  - Skip, Replay, speed toggle, reduced motion, navigation mid-fight;
  - arena rankings matrix links; locked arenas; no console errors.
- [x] Docs:
  - [docs/10-deathmatch.md](../10-deathmatch.md) — the reference for the game: concept, rules,
    screens, routes, data, storage;
  - [01-vision](../01-vision.md), [03-site](../03-site.md), [04-architecture](../04-architecture.md),
    [05-benchmarking](../05-benchmarking.md), [02-catalog](../02-catalog.md),
    [08-roadmap](../08-roadmap.md), [09-contributing](../09-contributing.md), [docs/README](../README.md);
  - this milestone folder: statuses ✅ and checked task lists.
- [x] README: name, what the deathmatch is, how a fight is scored (short), quick start, examples.
- [x] CLAUDE.md: minimal, current layout and commands.
- [x] Final gates: `bin/test.sh`, `bin/build.sh`, `bin/bench.sh -verify-only`.

## Outcome

- 30 / 30 implementations verified and benchmarked locally (Intel Core Ultra 9 285K, WSL2,
  `-cpuset 1`); four arenas open with six fighters each.
- The sanity check found a real problem: with image size in round 3, every arena ranked the
  fighters identically. Round 3 became **Brevity** (lines of code) — see
  [M3](m3-fight-engine.md#design-change-after-the-first-real-run). Three large benchmark cases were
  resized because CPython finished them in under 0.7 s (see [M4](m4-arena-roster.md)).
- Browser QA results: [M5](m5-deathmatch-ui.md#verification).

## Acceptance criteria

- All gates green; the published site (`site/` + generated data) shows four open arenas with six
  fighters each, and every fight is reproducible from `results.json`.
