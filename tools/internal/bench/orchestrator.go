package bench

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"

	"deathmatch/tools/internal/catalog"
	"deathmatch/tools/internal/docker"
)

// Clock provides timestamps.
type Clock interface {
	Now() time.Time
}

// Options selects what to run and where the inputs live.
type Options struct {
	Projects   []string // empty = all
	Languages  []string // empty = all
	VerifyOnly bool
	CPUSet     string
	Root       string // absolute repository root
	HarnessDir string // absolute host directory receiving ldmmeasure + ldmexec
}

// Orchestrator runs the benchmark pipeline.
type Orchestrator struct {
	Docker docker.Client
	Meta   MetaProvider
	Clock  Clock
	Log    io.Writer
}

// target is one implementation selected for this run.
type target struct {
	project catalog.Project
	impl    catalog.Implementation
}

// Run builds, verifies and (unless VerifyOnly) measures every selected implementation.
func (o Orchestrator) Run(ctx context.Context, c *catalog.Catalog, opts Options) (Results, error) {
	targets, err := selectTargets(c, opts)

	if err != nil {
		return Results{}, err
	}

	if !opts.VerifyOnly {
		if err := o.buildHarness(ctx, opts); err != nil {
			return Results{}, err
		}
	}

	results := Results{
		GeneratedAt: o.Clock.Now().UTC().Format(time.RFC3339),
		Commit:      o.Meta.Commit(ctx),
		Results:     make([]ImplResult, 0, len(targets)),
	}

	for _, t := range targets {
		results.Results = append(results.Results, o.runImplementation(ctx, t, opts))
	}

	results.Environment = o.environment(ctx, results.Results)
	return results, nil
}

func (o Orchestrator) buildHarness(ctx context.Context, opts Options) error {
	o.logf("==> building harness into %s", opts.HarnessDir)
	build := docker.BuildOptions{
		ContextDir: filepath.Join(opts.Root, "tools"),
		Target:     "harness",
		OutputDir:  opts.HarnessDir,
	}

	if err := o.Docker.Build(ctx, build); err != nil {
		return fmt.Errorf("build harness: %w", err)
	}

	return nil
}

// ImageTag returns the image name of an implementation.
func ImageTag(projectID, languageID string) string {
	return "deathmatch/" + projectID + "-" + languageID
}

func (o Orchestrator) runImplementation(ctx context.Context, t target, opts Options) ImplResult {
	tag := ImageTag(t.project.ID, t.impl.Language)
	result := ImplResult{Project: t.project.ID, Language: t.impl.Language, Status: StatusOK, Image: ImageRef{Tag: tag}}
	o.logf("==> %s/%s: build", t.project.ID, t.impl.Language)
	contextDir := filepath.Join(opts.Root, filepath.FromSlash(catalog.ImplDir(t.project.ID, t.impl.Language)))

	if err := o.Docker.Build(ctx, docker.BuildOptions{ContextDir: contextDir, Tag: tag}); err != nil {
		return result.fail(err.Error())
	}

	info, err := o.Docker.Inspect(ctx, tag)

	if err != nil || len(info.Entrypoint) == 0 {
		return result.fail(fmt.Sprintf("image %s has no usable ENTRYPOINT (%v)", tag, err))
	}

	result.Image.SizeBytes = info.SizeBytes
	result.Verification = o.verify(ctx, tag, t.project.Verify)

	if failed := failedChecks(result.Verification); len(failed) > 0 {
		return result.fail("verification failed: " + strings.Join(failed, "; "))
	}

	if opts.VerifyOnly {
		return result
	}

	for _, bc := range t.project.Benchmarks {
		caseResult := o.measure(ctx, measureRequest{image: tag, entrypoint: info.Entrypoint, bench: bc, opts: opts})
		result.Benchmarks = append(result.Benchmarks, caseResult)

		if caseResult.Status == StatusFailed {
			result.fail(fmt.Sprintf("benchmark %s: %s", bc.ID, caseResult.Error))
		}
	}

	return result
}

func (o Orchestrator) environment(ctx context.Context, results []ImplResult) Environment {
	env := Environment{Runner: o.Meta.Runner()}

	if version, err := o.Docker.ServerVersion(ctx); err == nil {
		env.Docker = version
	}

	for _, result := range results {
		for _, bc := range result.Benchmarks {
			if bc.host.CPUs > 0 {
				env.CPUModel, env.CPUs, env.Kernel, env.Arch = bc.host.CPUModel, bc.host.CPUs, bc.host.Kernel, bc.host.Arch
				return env
			}
		}
	}

	return env
}

func (o Orchestrator) logf(format string, args ...any) {
	fmt.Fprintf(o.Log, format+"\n", args...)
}
