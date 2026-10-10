# 9. Contributing

## Add a project

1. Write the spec in `docs/projects/<id>.md` (goal, input, output, errors, rules,
   verification cases, benchmark cases). Pick a category and level from
   [the catalog](02-catalog.md).
2. Compute expected outputs with a reference implementation and record them as exact
   `stdout` (small) or `sha256` (large).
3. Create `projects/<id>/project.json` (see [Architecture](04-architecture.md#manifests)).
4. Add implementations (next section).
5. Run `bin/build.sh` (validates manifests) and `bin/bench.sh -project <id>`.

## Add an implementation

1. Create `projects/<project>/<language-id>/` with the sources and a `Dockerfile` that builds
   `FROM` the language's pinned image (see `catalog/languages.json`) and sets `ENTRYPOINT` to
   the program.
2. Add `impl.json` listing the files to show (`source` files first) and short notes.
3. Check it: `bin/bench.sh -verify-only -project <project> -lang <language-id>`.

Example (`projects/fibonacci/go/impl.json`):

```json
{
  "notes": ["uint64 wraps natively", "strconv.AppendUint into a reused buffer"],
  "files": [
    { "path": "main.go", "role": "source" },
    { "path": "go.mod", "role": "build" },
    { "path": "Dockerfile", "role": "build" }
  ]
}
```

## Add a language

1. Add an entry to `catalog/languages.json` (`id`, `name`, brand `color`, `kind`, `toolchain`,
   pinned `image`, `website`) with its required `fighter` profile (`glyph`, `nickname`, `special`,
   `fatality`, `quote`) — see [Architecture](04-architecture.md#cataloglanguagesjson).
2. If the language uses file extensions unknown to the tools, add them to the highlight map in
   `tools/internal/catalog/highlight.go`, and load the highlight.js language pack in
   `site/index.html` if it is not in the common bundle.
3. Implement at least the Level 1 projects.
4. CI picks up the new language automatically (the verify matrix is generated from the catalog),
   and it enters every arena where it has verified results.

## Add a category (arena)

Add an entry to `catalog/categories.json` with its required `arena` profile (`stage`, `tagline`,
`color`). The arena opens on the site as soon as two languages have results for one of its projects.

## Quality gates

- `bin/test.sh` must pass (Go unit tests + site unit tests).
- `bin/bench.sh -verify-only` must pass for the touched implementations.
- Keep `README.md`, `CLAUDE.md` and these docs in sync with the change.
