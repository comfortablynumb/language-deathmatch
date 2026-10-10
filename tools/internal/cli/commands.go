package cli

import (
	"context"
	"fmt"
	"io"
	"io/fs"

	"deathmatch/tools/internal/bench"
	"deathmatch/tools/internal/catalog"
	"deathmatch/tools/internal/docker"
	"deathmatch/tools/internal/jsonio"
	"deathmatch/tools/internal/sitegen"
)

// CatalogDeps are the dependencies of `ldm catalog`.
type CatalogDeps struct {
	Source fs.FS // repository root
	Output jsonio.Writer
	Clock  sitegen.Clock
	Log    io.Writer
}

// BenchDeps are the dependencies of `ldm bench`.
type BenchDeps struct {
	Source fs.FS // repository root
	Output jsonio.Writer
	Docker docker.Client
	Meta   bench.MetaProvider
	Clock  bench.Clock
	Log    io.Writer
}

// RunCatalog validates the manifests and writes the site data documents.
func RunCatalog(cfg CatalogConfig, deps CatalogDeps) error {
	c, err := catalog.Load(deps.Source)

	if err != nil {
		return err
	}

	generator := sitegen.Generator{Source: deps.Source, Output: deps.Output, Clock: deps.Clock, OutDir: cfg.OutDir}

	if err := generator.Generate(c); err != nil {
		return err
	}

	fmt.Fprintf(deps.Log, "catalog: %d languages, %d projects -> %s\n", len(c.Languages), len(c.Projects), cfg.OutDir)
	return nil
}

// RunBench runs the benchmark pipeline and writes the results file. Verify-only runs
// do not write results. It fails when any implementation failed.
func RunBench(ctx context.Context, cfg BenchConfig, deps BenchDeps) error {
	c, err := catalog.Load(deps.Source)

	if err != nil {
		return err
	}

	orchestrator := bench.Orchestrator{Docker: deps.Docker, Meta: deps.Meta, Clock: deps.Clock, Log: deps.Log}
	results, err := orchestrator.Run(ctx, c, benchOptions(cfg))

	if err != nil {
		return err
	}

	if !cfg.VerifyOnly {
		if err := deps.Output.WriteJSON(cfg.Out, results); err != nil {
			return err
		}

		fmt.Fprintf(deps.Log, "results: %d implementations -> %s\n", len(results.Results), cfg.Out)
	}

	if failed := results.FailedCount(); failed > 0 {
		return fmt.Errorf("%d of %d implementations failed", failed, len(results.Results))
	}

	return nil
}

func benchOptions(cfg BenchConfig) bench.Options {
	return bench.Options{
		Projects:   cfg.Projects,
		Languages:  cfg.Languages,
		VerifyOnly: cfg.VerifyOnly,
		CPUSet:     cfg.CPUSet,
		Root:       cfg.Root,
		HarnessDir: cfg.HarnessDir,
	}
}
