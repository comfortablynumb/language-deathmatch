# Language Deathmatch — Planning Docs

Planning and design documents for **Language Deathmatch**: a static website where programming
languages fight each other, arena by arena, using real benchmarks of the same applications —
implemented idiomatically in every language, shown side by side, verified byte for byte and
measured in CI inside Docker containers.

| # | Document | What it covers |
|---|----------|----------------|
| 1 | [Vision](01-vision.md) | Goals, non-goals, guiding principles |
| 2 | [Project catalog](02-catalog.md) | Categories (arenas), complexity levels, tags, projects |
| 3 | [Website](03-site.md) | Pages, features, UX, tech stack |
| 4 | [Architecture](04-architecture.md) | Repository layout, manifests, generated data contracts |
| 5 | [Benchmarking](05-benchmarking.md) | Methodology, harness, metrics, statistics, fairness rules |
| 6 | [Languages](06-languages.md) | Supported languages, toolchains, per-language conventions |
| 7 | [CI / CD](07-ci.md) | GitHub Actions workflows, deployment |
| 8 | [Roadmap](08-roadmap.md) | Phased delivery plan with status |
| 9 | [Contributing](09-contributing.md) | How to add a project, an implementation, a language |
| 10 | [Deathmatch](10-deathmatch.md) | Fighters, arenas, rules of combat, towers, screens |

The deathmatch was planned and delivered in six milestones: [milestones/](milestones/README.md)
(rebrand, catalog profiles, fight engine, arena roster, UI, launch).

Project specifications:

| Project | Level | Arena (category) |
|---------|-------|------------------|
| [Fibonacci](projects/fibonacci.md) | 1 · Trivial | Algorithms & Math — The Number Pit |
| [Primes sieve](projects/primes-sieve.md) | 2 · Easy | Algorithms & Math — The Number Pit |
| [Fasta](projects/fasta.md) | 2 · Easy | Text & Data Processing — The Scriptorium |
| [Binary trees](projects/binary-trees.md) | 3 · Medium | Data Structures & Memory — The Heap |
| [Mandelbrot](projects/mandelbrot.md) | 3 · Medium | Simulation & Graphics — The Floating Point |

Status legend used across the docs: **✅ Done** (implemented in this repository),
**🔜 Planned** (designed here, not implemented yet).
