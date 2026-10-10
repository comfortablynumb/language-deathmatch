# 5. Benchmarking

## Pipeline (per implementation)

1. **Build** — `docker build -t deathmatch/<project>-<lang> projects/<project>/<lang>`.
2. **Inspect** — read the image `ENTRYPOINT` (the command to benchmark) and its size.
3. **Verify** — run every verification case: `docker run --rm --network none <image> <args>`;
   compare the exit code and stdout (exact text or SHA-256). Any mismatch marks the
   implementation `failed` and skips its benchmarks.
4. **Measure** — for every benchmark case run the harness *inside* the container:

   ```
   docker run --rm --network none [--cpuset-cpus N] \
     --mount type=bind,source=<repo>/build/harness,target=/ldm,readonly \
     --entrypoint /ldm/ldmmeasure <image> -runs R -warmup W -sha256 H -- <entrypoint…> <args…>
   ```

   Running the harness inside the container removes `docker run` overhead (hundreds of
   milliseconds) from the measurements: only the program's own process is timed.

## The harness: `ldmmeasure` + `ldmexec`

Both are built by `tools/Dockerfile` and mounted read-only at `/ldm`:

- **`ldmexec`**: a small static C launcher (musl). It forks the program, waits with `wait4`
  and writes `exit wall-ns user-ns sys-ns maxrss-kib` to file descriptor 3. Forking from a tiny
  process matters: Linux keeps the high-water mark of the *old* address space across `execve`,
  so a program forked directly from the Go harness would report the harness's memory as its own.
- **`ldmmeasure`**: the Go harness. For one benchmark case it:
  1. Runs the program once with stdout streamed into a SHA-256 hasher and checks the digest
     (`-sha256`) and exit code `0`. A mismatch aborts the case.
  2. Runs `warmup` untimed iterations (stdout → `/dev/null`).
  3. Runs `runs` **timed** iterations (stdout → `/dev/null`): wall time and CPU time.
  4. Runs `memory-runs` (default 3) untimed **memory** iterations with `ldmexec -m`.
  5. Prints one JSON document with the samples and the host info (CPU model, CPUs, kernel).

Every run has a timeout (`-timeout`, default 2 minutes); a timeout or non-zero exit fails the case.

### Exact peak memory

Since Linux 6.2 the per-process RSS counters behind `ru_maxrss` and `/proc/<pid>/status` are
per-CPU approximations: a process touching less than a few hundred KiB can read as **0 KiB**
(measured on a 24-CPU kernel 6.6: 64 KiB touched → 0, 256 KiB → 192). In memory mode `ldmexec`
traces the child (`PTRACE_TRACEME` + `PTRACE_O_TRACEEXIT`), stops it right before it exits,
with its address space still intact, and reads its exact RSS from `/proc/<pid>/smaps_rollup`
(a page-table walk). Reported peak = `max(ru_maxrss, exact RSS at exit)`. Tracing adds
overhead, so memory runs are never timed.

## Metrics

| Metric | Source | Shown as |
|--------|--------|----------|
| Wall time | `ldmexec`, per timed run | median (primary), mean ± stddev, min/max, box plot |
| CPU time | `ldmexec`, user + sys | median |
| Peak memory | `ldmexec -m`, per memory run | median, KiB/MiB |
| Image size | sum of `docker history` layer sizes (uncompressed) | bytes → MiB |
| Lines of code | `ldm catalog`, non-blank lines of `source` files | integer |
| Build time / binary size | — | 🔜 Planned |

## Statistics

- **Median** is the headline number (robust to scheduler noise); quartiles (Q1, Q3), min, max
  feed the box plot; mean and sample standard deviation are shown in the table.
- No outlier removal: all samples are published in `results.json`.
- **Relative factor** = `median / fastest median` of the same case (1.00× is the winner).
- **Leaderboard score** = geometric mean of a language's relative factors across all cases it
  completed; coverage is shown next to the score so partial coverage is visible.
- **Deathmatch fights** use the same medians (wall time, peak memory) plus lines of code; a round's
  winner is the fighter that is better on the geometric mean of the ratios. Rules:
  [Deathmatch](10-deathmatch.md).

## Fairness rules

1. Same spec, same verification, same harness, same image constraints for every language.
2. Same algorithm (as mandated by the project spec) — no closed-form tricks, no precomputed tables.
3. Idiomatic code with the standard library; buffered output is allowed and expected.
4. Release builds with the language's customary flags (documented in each Dockerfile).
5. Single process and no explicit parallelism in the program (a runtime's own GC or I/O helper
   threads are fine) unless the project is in the `concurrency` category.
6. All implementations of one run are benchmarked **sequentially on the same machine**;
   results from different runs are never mixed in one chart.
7. Containers run with `--network none`; optional CPU pinning with `-cpuset` reduces noise.

## Environment captured with every run

CPU model, number of CPUs, kernel version, architecture, Docker server version, git commit,
runner (`github-actions` or `local`) and timestamp — shown on the Benchmarks tab and the
Methodology page.

## Server benchmarks 🔜 Planned

For `server` / `stack` projects: start the container(s), wait for a readiness probe, then run a
load generator container (e.g. `oha`) on the same Docker network for a fixed duration and
concurrency. Metrics: requests/s, latency p50/p90/p99, error rate, peak memory
(`docker stats`), time-to-first-response. Stacks with databases are orchestrated with Docker
Compose and get `bin/up.sh` / `bin/down.sh` helpers.
