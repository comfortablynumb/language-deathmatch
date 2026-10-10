# M2 — Fighters & arenas in the catalog

**Status:** ✅ Done · **Depends on:** M1 · **Unblocks:** M3, M5

## Goal

Give every language a **fighter profile** and every category an **arena profile**, validated
like the rest of the catalog, and make the generated `site/data/catalog.json` carry everything a
fight needs, so fights are computed from the two documents the site already loads at startup
(`catalog.json` + `results.json`) without fetching every project document.

## Manifest changes

### `catalog/languages.json` — `fighter` (required)

```json
{
  "id": "rust", "name": "Rust", "color": "#DEA584", "kind": "compiled", "…": "…",
  "fighter": {
    "glyph": "Rs",
    "nickname": "The Crab",
    "special": "Borrow Checker Slam",
    "fatality": "Lifetime Expired",
    "quote": "Fearless. Safe. Merciless."
  }
}
```

| Field | Rule | Used for |
|-------|------|----------|
| `glyph` | 1–4 characters, no spaces | The fighter's portrait / sprite emblem |
| `nickname` | non-empty | Under the name on select, tower and fight screens |
| `special` | non-empty | Move name of blows won by 5× or more |
| `fatality` | non-empty | Move name of the finishing blow of a fatality |
| `quote` | non-empty | Victory screen |

Initial roster:

| Language | Glyph | Nickname | Special | Fatality | Quote |
|----------|-------|----------|---------|----------|-------|
| Go | Go | The Gopher | Goroutine Barrage | Garbage Collected | Simple wins. Ship it. |
| Rust | Rs | The Crab | Borrow Checker Slam | Lifetime Expired | Fearless. Safe. Merciless. |
| C++ | C++ | The Template | Template Avalanche | Undefined Behavior | You only pay for what you use. You lose. |
| Assembly | ASM | The Bare Metal | Raw Syscall | Segmentation Fault | No runtime. No mercy. |
| Python | Py | The Serpent | Comprehension Coil | IndentationError | Readability counts. So does winning. |
| JavaScript | JS | The Event Loop | Callback Combo | undefined is not a function | I run everywhere. Even here. |

### `catalog/categories.json` — `arena` (required)

```json
{
  "id": "algorithms", "name": "Algorithms & Math", "description": "…",
  "arena": { "stage": "The Number Pit", "tagline": "Tight loops and raw arithmetic. Nowhere to hide.", "color": "#f97316" }
}
```

| Field | Rule | Used for |
|-------|------|----------|
| `stage` | non-empty | Arena title on select, tower and fight screens |
| `tagline` | non-empty | One-line flavor text |
| `color` | `#RRGGBB` | Stage glow / backdrop of the fight scene |

| Category | Stage | Tagline | Color |
|----------|-------|---------|-------|
| algorithms | The Number Pit | Tight loops and raw arithmetic. Nowhere to hide. | `#f97316` |
| data-structures | The Heap | Allocate fast or get collected. | `#22c55e` |
| text-processing | The Scriptorium | Every byte formatted, every line written. | `#eab308` |
| simulation | The Floating Point | Physics, fractals and a billion multiplications. | `#06b6d4` |
| concurrency | The Thread Pit | Many hands, one winner. | `#a855f7` |
| web | The Request Gauntlet | Throughput under fire. | `#3b82f6` |
| systems | The Datacenter | Databases, caches and nowhere to run. | `#ef4444` |

## Generated data changes (`ldm catalog`)

`site/data/catalog.json` already serializes languages and categories, so the profiles flow through
the Go structs. Each project summary gains two fields:

```json
{
  "id": "fibonacci", "…": "…", "languages": ["go", "rust"],
  "benchmarks": [ { "id": "startup", "name": "Startup" }, { "id": "throughput", "name": "Throughput" } ],
  "loc": { "go": 41, "rust": 39 }
}
```

- `benchmarks` — case ids and names in `project.json` order (fight commentary names cases).
- `loc` — non-blank source lines per language (the Brevity round), the same number the project
  page shows. `ldm catalog` already computes it while writing project documents; the summary is
  built from the same computation so both always agree.

## Tasks

- [x] `catalog.Fighter`, `catalog.Arena` types; `Language.Fighter`, `Category.Arena` fields.
- [x] Validation: required fields, glyph length 1–4 without whitespace, arena color `#RRGGBB`;
      every problem reported at once (existing `problems` collector).
- [x] `sitegen.ProjectSummary`: `Benchmarks []CaseRef`, `LOC map[string]int`; LOC computed once per
      implementation and reused by the summary and the project document.
- [x] Fill `languages.json` and `categories.json` with the tables above.
- [x] Tests (fakes only, `fstest.MapFS` + `jsonio.MemoryWriter`):
  - valid catalog loads with profiles;
  - missing fighter field, 5-character glyph, glyph with a space, bad arena color → errors;
  - summary has `benchmarks` in order and `loc` equal to the project document's `loc`.
- [x] Docs: [04-architecture](../04-architecture.md) manifests + data contracts,
      [09-contributing](../09-contributing.md) "Add a language" (fighter profile is required).

## Acceptance criteria

- `go test ./...` green with the new cases; `bin/build.sh` regenerates `catalog.json` with
  `fighter`, `arena`, `benchmarks` and `loc`.
- A language without a `fighter` block is rejected with a message naming the file and field.
