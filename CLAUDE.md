# Language Deathmatch

Static site (jQuery + Tailwind 4 + ECharts + highlight.js, ES modules, no bundler) where languages fight
each other in arenas (project categories) using real benchmarks of the same programs; Go tooling
builds/verifies/benchmarks them in Docker. Plans: `docs/` (milestones in `docs/milestones/`).

## Layout
- `catalog/` languages (+ `fighter` profile; pinned `image` must match each Dockerfile's first FROM), categories (+ `arena` profile), levels
- `projects/<id>/project.json` spec + verify cases + benchmark cases; `projects/<id>/<lang>/` impl + `impl.json` + Dockerfile (ENTRYPOINT = program)
- `tools/` Go module `deathmatch/tools`: `cmd/ldm` (catalog, bench), `cmd/ldmmeasure` (in-container harness), `ldmexec/ldmexec.c` (launcher, `-m` exact memory via ptrace), `Dockerfile` (harness build), `internal/*` (catalog, sitegen, bench, docker, execx, measure, stats, cli, jsonio, textutil)
- `site/` published as-is; `site/data/` and `site/assets/css/app.css` are generated (git-ignored)
- `site/assets/js/` lib (pure, tested) / ui / views / app.js; deathmatch: `lib/{arena,fight,tournament,progress,fight-script,player}.js`, `ui/{fighter,fight-stage,storage}.js`, `views/deathmatch*.js`; rules in `docs/10-deathmatch.md`
- `site/assets/css/input.css` (Tailwind) imports `deathmatch.css` (components layer)
- `tests/site/` node tests for `site/assets/js/lib`

## Commands
- `bin/test.sh` Go vet+tests and `npm test`
- `bin/build.sh` catalog → site/data, CSS
- `bin/bench.sh [-verify-only] [-project p] [-lang a,b] [-cpuset 1]` → site/data/results.json (needs Docker)
- `bin/serve.sh [port]`

## Conventions
- Every dependency behind an interface (fs.FS, execx.Runner, docker.Client, Clock, Env); tests use fakes only
- Functions ≤ 50 lines, ≤ 4 params, blank line before if/for/switch (except at block start)
- Implementations: idiomatic, stdlib only, same algorithm; verify via project.json cases
- Keep README.md and docs/ in sync with changes
