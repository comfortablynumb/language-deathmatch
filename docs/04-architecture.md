# 4. Architecture

## Data flow

```
catalog/*.json ──┐
                 ├──► ldm catalog ──► site/data/catalog.json
projects/**  ────┤                   site/data/projects/<id>.json
                 │
                 └──► ldm bench ──► docker build ──► docker run (verification cases)
                                         │
                                         └──► docker run ldmmeasure (benchmark cases)
                                                        │
                                                        ▼
                                               site/data/results.json

site/ (static HTML + JS) ──► fetches site/data/*.json ──► renders pages & charts
```

`ldm` and `ldmmeasure` are Go programs in `tools/`. The website never computes anything
heavy: it only ranks and formats what the tools produced.

## Repository layout

```
language-deathmatch/
├── catalog/                  # global definitions
│   ├── languages.json        # id, name, brand color, kind, toolchain, base image, fighter profile
│   ├── categories.json       # id, name, description, arena profile
│   └── levels.json           # level 1..5, name, description
├── projects/
│   └── <project-id>/
│       ├── project.json      # metadata, spec, verification & benchmark cases
│       └── <language-id>/    # one folder per implementation
│           ├── impl.json     # files to show (+ role), notes
│           ├── Dockerfile    # builds and runs the program (ENTRYPOINT = the program)
│           └── …sources
├── tools/                    # Go module: ldm (host CLI) + ldmmeasure (in-container harness)
├── site/                     # static website (published as-is)
│   ├── index.html
│   ├── assets/{css,js,img}/
│   └── data/                 # generated, git-ignored
├── tests/site/               # node --test unit tests for site/assets/js/lib
├── package.json              # Tailwind CLI + npm scripts (build:css, test)
├── bin/                      # build.sh, bench.sh, serve.sh, test.sh
├── docs/                     # these planning docs
└── .github/workflows/        # ci.yml, bench.yml
```

## Manifests

### `catalog/languages.json`

```json
[{ "id": "go", "name": "Go", "color": "#00ADD8", "kind": "compiled",
   "toolchain": "Go 1.27", "image": "golang:1.27-alpine3.24", "website": "https://go.dev",
   "fighter": { "glyph": "Go", "nickname": "The Gopher", "special": "Goroutine Barrage",
                "fatality": "Garbage Collected", "quote": "Simple wins. Ship it." } }]
```

`kind` ∈ `compiled | interpreted | jit | assembled`. `image` is the pinned toolchain image:
`ldm catalog` fails if an implementation's Dockerfile does not build `FROM` that image, which
guarantees every project of a language uses the same toolchain.

`fighter` is the language's [deathmatch](10-deathmatch.md) profile and is required: `glyph`
(1–4 characters, no spaces: the fighter's emblem), `nickname`, `special` (move name of blows won
by 5× or more), `fatality` (finishing move of a fatality) and `quote` (victory screen).

### `catalog/categories.json`

```json
[{ "id": "algorithms", "name": "Algorithms & Math", "description": "…",
   "arena": { "stage": "The Number Pit", "tagline": "Tight loops and raw arithmetic. Nowhere to hide.", "color": "#f97316" } }]
```

Every category is a deathmatch **arena**; `arena` is required: `stage` (arena title), `tagline`
and `color` (`#RRGGBB`, the glow of the fight stage).

### `projects/<id>/project.json`

```json
{
  "name": "Fibonacci",
  "summary": "Print the first N Fibonacci numbers.",
  "category": "algorithms",
  "level": 1,
  "kind": "cli",
  "tags": ["cpu-bound", "loops"],
  "spec": { "description": "…", "input": "…", "output": "…", "rules": ["…"] },
  "verify": [
    { "name": "first ten", "args": ["10"], "exitCode": 0, "stdout": "0\n1\n1\n2\n3\n5\n8\n13\n21\n34\n" },
    { "name": "wraps at 2^64", "args": ["100"], "exitCode": 0, "sha256": "521c…0185" }
  ],
  "benchmarks": [
    { "id": "startup", "name": "Startup", "description": "…", "args": ["10"],
      "warmup": 3, "runs": 30, "sha256": "356f…2ad5" }
  ]
}
```

Rules enforced by `ldm catalog`: the id is the folder name; `category` and `level` exist in the
catalog; `kind` is supported (`cli` today); every verification case has exactly one of
`stdout` / `sha256`; every benchmark case has an id, `runs ≥ 1`, `warmup ≥ 0` and a `sha256`.

### `projects/<id>/<lang>/impl.json`

```json
{
  "notes": ["bufio.Writer with a 64 KiB buffer", "strconv.AppendUint avoids allocations"],
  "files": [
    { "path": "main.go", "role": "source" },
    { "path": "go.mod", "role": "build" },
    { "path": "Dockerfile", "role": "build" }
  ]
}
```

The language is the folder name (must exist in `languages.json`). Files are shown in this
order; **lines of code** count the non-blank lines of `source` files only.

### Dockerfile contract

- Multi-stage when compiling; the final image contains only what is needed to run.
- `ENTRYPOINT` (exec form) **is** the program, so `docker run --rm deathmatch/fibonacci-go 10` works.
- No network access is needed at run time (benchmarks run with `--network none`).
- Images are tagged `deathmatch/<project>-<language>`.

## Generated data contracts

### `site/data/catalog.json`

```json
{
  "generatedAt": "2026-10-08T12:00:00Z",
  "languages":  [ { "id", "name", "color", "kind", "toolchain", "image", "website", "fighter" } ],
  "categories": [ { "id", "name", "description", "arena" } ],
  "levels":     [ { "level", "name", "description" } ],
  "projects":   [ { "id", "name", "summary", "category", "level", "kind", "tags", "languages": ["go", "…"],
                    "benchmarks": [ { "id": "startup", "name": "Startup" } ], "loc": { "go": 41, "…": 0 } } ]
}
```

`benchmarks` (case ids and names) and `loc` (non-blank source lines per language, the same count
as in the project document) let the website compute fights from `catalog.json` + `results.json`
alone, without loading every project document.

### `site/data/projects/<id>.json`

Everything from `project.json` plus:

```json
"implementations": [ {
  "language": "go", "notes": ["…"], "loc": 41,
  "files": [ { "path": "main.go", "role": "source", "highlight": "go", "lines": 52, "content": "…" } ]
} ]
```

### `site/data/results.json`

```json
{
  "generatedAt": "…", "commit": "abc1234",
  "environment": { "cpuModel": "…", "cpus": 4, "kernel": "…", "arch": "amd64",
                   "docker": "28.5.1", "runner": "github-actions" },
  "results": [ {
    "project": "fibonacci", "language": "go", "status": "ok", "error": "",
    "image": { "tag": "deathmatch/fibonacci-go", "sizeBytes": 1523712 },
    "verification": [ { "name": "first ten", "passed": true, "message": "" } ],
    "benchmarks": [ {
      "case": "startup", "status": "ok", "error": "",
      "samples": { "wallNs": [], "cpuNs": [], "maxRssKb": [] },
      "stats": {
        "wallNs":   { "min", "q1", "median", "q3", "max", "mean", "stddev" },
        "cpuNs":    { "…same…" },
        "maxRssKb": { "…same…" }
      }
    } ]
  } ]
}
```

`status` is `ok` or `failed`; failed implementations keep their `error` and are excluded
from rankings. `wallNs`/`cpuNs` come from the timed runs, `maxRssKb` from the memory runs.
`image.sizeBytes` is the uncompressed image size: the sum of the layer sizes reported by
`docker history` (`docker image inspect` reports compressed sizes with the containerd image
store, uncompressed ones with overlay2).

## Tools (`tools/`, Go)

```
tools/
├── Dockerfile         # builds the harness (ldmmeasure + ldmexec) for linux/amd64
├── ldmexec/ldmexec.c  # tiny static launcher: fork/exec/wait4, exact memory mode
├── cmd/ldm/           # host CLI entrypoint: wires dependencies, dispatches subcommands
├── cmd/ldmmeasure/    # in-container harness entrypoint (static Go binary)
└── internal/
    ├── cli/           # flag parsing + subcommand runners (catalog, bench)
    ├── catalog/       # load + validate manifests from an fs.FS
    ├── sitegen/       # build site JSON documents from the catalog
    ├── bench/         # orchestration: build → verify → measure → results
    ├── docker/        # Docker CLI client behind an interface
    ├── execx/         # external command runner behind an interface
    ├── measure/       # harness protocol, launcher stats parsing, host probe
    ├── stats/         # quantiles, mean, standard deviation
    ├── textutil/      # line counting helpers
    └── jsonio/        # JSON file writing behind an interface
```

Every external dependency (filesystem, `docker` CLI, process execution, clock) sits behind an
interface, so the unit tests use in-memory fakes only.

### CLI

```
ldm catalog [-root .] [-out site/data]
ldm bench   [-root .] [-out site/data/results.json] [-harness build/harness]
            [-project fibonacci] [-lang go,rust] [-verify-only] [-cpuset 1]
ldmmeasure  [-runs 10] [-warmup 1] [-memory-runs 3] [-timeout 2m] [-sha256 HEX]
            [-launcher /ldm/ldmexec] -- <command> [args…]
ldmexec     [-m] <command> [args…]      # stats line on fd 3
```

`ldm bench` first exports the harness with
`docker build --target harness --output type=local,dest=build/harness tools`, then mounts that
directory read-only at `/ldm` in every benchmark container.
