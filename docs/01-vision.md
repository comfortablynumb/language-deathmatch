# 1. Vision

## What

Language Deathmatch implements the **same applications in several programming languages** and
publishes them on a website where visitors can:

1. **Make them fight** — choose a language (a *fighter*) and a type of problem (an *arena*: a
   project category), then climb a tower, fighting every other language one after another, arcade
   style. Every blow is a real benchmark number; nothing is random (see [Deathmatch](10-deathmatch.md)).
2. **Read and compare the code** — idiomatic implementations shown side by side.
3. **Compare the numbers** — wall time, CPU time, peak memory, image size and lines of code,
   measured by the CI on identical hardware, inside Docker containers.

Applications range from trivial programs (Fibonacci) to HTTP APIs and complete multi-service
systems, and every project is **categorized** (its arena) and **tagged with a complexity level** so
visitors can browse from simple to complex.

## Goals

| Goal | How |
|------|-----|
| Fair comparison | Same spec, same verification, same hardware, same harness, same container limits for every language |
| Reproducibility | Everything runs from pinned Docker images; any visitor can rerun `bin/bench.sh` locally |
| Transparency | Raw samples, environment (CPU, kernel, Docker version, commit) and methodology are published with the results |
| Readability | Implementations are **idiomatic first**: what an experienced developer would write with the standard library |
| Zero-build website | Static site: jQuery + Tailwind CSS + ECharts + highlight.js; data is plain JSON |
| Growth | Adding a project or a language is a matter of adding folders and JSON manifests; no site code changes |
| Fun, but honest | Fights are deterministic replays of the published results; every blow shows the two values it comes from, and the scoring rules are public |

## Non-goals

- Not a micro-optimization contest: hand-tuned "fastest possible" versions are a separate,
  explicitly labelled **variant** (🔜 planned), never mixed with idiomatic implementations.
- Not a statement about which language is "best": benchmarks measure *one program*, *one
  toolchain*, *one machine*. The site always shows the context — a deathmatch champion is the
  champion of *these* programs on *this* run, nothing more.
- No server-side runtime for the website: it is deployed as static files (GitHub Pages).

## Principles

1. **Spec first.** Every project has a precise, language-agnostic spec (input, output,
   error handling) and a list of verification cases. An implementation that does not
   reproduce the expected output byte-for-byte is not benchmarked.
2. **Same algorithm.** All implementations of a project use the algorithm mandated by the spec
   (e.g. iterative Fibonacci), so the comparison is about languages and runtimes, not algorithms.
3. **Standard library only** unless the spec explicitly allows a dependency (e.g. a web framework
   for API projects, where the allowed choices are listed per language).
4. **Release builds.** Compiled languages use their usual optimized release settings.
5. **No placeholders.** A language that does not implement a project simply shows
   "not implemented" in the coverage matrix; nothing is faked.
