# M1 — Rebrand: Language Wars → Language Deathmatch

**Status:** ✅ Done · **Depends on:** — · **Unblocks:** M2, M4

## Goal

One name everywhere. The old name is not only in titles: it is baked into tool names, the Go
module path, Docker image tags, the harness mount point, CSS tokens and docs. Renaming them all
now (before new projects and new code are added) avoids a mixed codebase.

## Rename map

| Where | Old | New |
|-------|-----|-----|
| Product name (site, docs, README, CLAUDE.md, scripts) | Language Wars | **Language Deathmatch** |
| `package.json` name | `language-wars` | `language-deathmatch` |
| Go module (`tools/go.mod`, every import) | `langwars/tools` | `deathmatch/tools` |
| Host CLI | `tools/cmd/lw`, binary `build/lw` | `tools/cmd/ldm`, binary `build/ldm` |
| In-container harness | `tools/cmd/lwmeasure`, `lwmeasure` | `tools/cmd/ldmmeasure`, `ldmmeasure` |
| Launcher | `tools/lwexec/lwexec.c`, `lwexec` | `tools/ldmexec/ldmexec.c`, `ldmexec` |
| Harness mount in benchmark containers | `/lw` (`/lw/lwmeasure`, `/lw/lwexec`) | `/ldm` (`/ldm/ldmmeasure`, `/ldm/ldmexec`) |
| Docker image tags | `langwars/<project>-<language>` | `deathmatch/<project>-<language>` |
| Fibonacci Go module | `langwars/fibonacci` | `deathmatch/fibonacci` |
| CSS chart tokens | `--lw-*` | `--ldm-*` |
| Prose class | `.prose-lw` | `.prose-ldm` |
| Repository tree root in docs | `lang-wars/` | `language-deathmatch/` |

Generated, git-ignored outputs (`build/`, `site/data/`, `site/assets/css/app.css`) are rebuilt,
not edited; stale `build/lw*` and `build/harness/lw*` binaries are deleted.

## Visual identity

The site keeps its validated dark palette and single chart series hue, and adds a fighting-game
layer used by the deathmatch screens (M5) and the hero:

| Token | Value | Use |
|-------|-------|-----|
| `--color-blood` | `#c81e1e` | Announcer text shadow, K.O. / fatality accents |
| `--color-gold` | `#f5b301` | Announcer fill, round-win medallions, champion badges |
| `--font-display` | **Teko** (Google Fonts, 500/600/700) | Announcer text, fighter names, screen titles |

- **Logo** (`site/assets/img/logo.svg`): a round medallion with a flame-gradient ring and two
  crossed blades — readable at 16 px as a favicon.
- **Hero** copy: "Language **Deathmatch**" — *Choose your fighter. Choose your arena. Fight every
  other language — on real benchmarks.*
- **Disclaimer** in the footer: an homage to classic fighting games, not affiliated with any of them.

## Tasks

- [x] Rename tools: move `cmd/lw` → `cmd/ldm`, `cmd/lwmeasure` → `cmd/ldmmeasure`,
      `lwexec/` → `ldmexec/`; update `tools/Dockerfile` stages and outputs, flag-set names,
      usage strings, error prefixes, comments.
- [x] Go module path `deathmatch/tools`; update every import; `go vet` + `go test` green.
- [x] Harness constants (`harnessMount`, `harnessBin`, default `-launcher`) and their tests.
- [x] `bench.ImageTag` → `deathmatch/…`; tests and docs that show tags.
- [x] `bin/*.sh` build `build/ldm`, print the new name.
- [x] Site: `<title>`, header brand, footer (+ disclaimer), `noscript`, every `document.title`,
      hero; `--lw-*` → `--ldm-*` in CSS and `ui/charts.js`; `.prose-lw` → `.prose-ldm`.
- [x] Fonts: add Teko to the Google Fonts link; `--font-display`, `--color-blood`, `--color-gold`.
- [x] New `logo.svg`.
- [x] Docs, README, CLAUDE.md: new name, tool names, paths.

## Acceptance criteria

- `grep -riE "language ?wars|langwars|lang-wars|lwexec|lwmeasure|--lw-|prose-lw|cmd/lw\b|/lw\b"`
  over the repository (excluding `node_modules/`, `build/`, generated `site/data/` and `app.css`)
  returns nothing.
- `bin/test.sh` and `bin/build.sh` pass; `bin/bench.sh -verify-only -project fibonacci` passes and
  produces `deathmatch/fibonacci-*` images.
- The site renders with the new name, logo and fonts.
