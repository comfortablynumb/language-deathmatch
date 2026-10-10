package bench

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"deathmatch/tools/internal/catalog"
	"deathmatch/tools/internal/docker"
	"deathmatch/tools/internal/measure"
	"deathmatch/tools/internal/textutil"
)

// Paths of the harness inside benchmark containers.
const (
	harnessMount = "/ldm"
	harnessBin   = harnessMount + "/ldmmeasure"
	messageLimit = 160
)

// measureRequest groups the inputs of one benchmark case run.
type measureRequest struct {
	image      string
	entrypoint []string
	bench      catalog.BenchmarkCase
	opts       Options
}

func (o Orchestrator) verify(ctx context.Context, image string, cases []catalog.VerifyCase) []CaseCheck {
	checks := make([]CaseCheck, 0, len(cases))

	for _, vc := range cases {
		run, err := o.Docker.Run(ctx, docker.RunOptions{Image: image, Args: vc.Args})
		check := checkCase(vc, run, err)
		checks = append(checks, check)

		if !check.Passed {
			o.logf("    FAIL %s: %s", vc.Name, check.Message)
		}
	}

	o.logf("    verification: %d/%d passed", len(cases)-len(failedChecks(checks)), len(cases))
	return checks
}

// checkCase compares a container run with a verification case.
func checkCase(vc catalog.VerifyCase, run docker.RunResult, err error) CaseCheck {
	check := CaseCheck{Name: vc.Name}
	stdout := string(run.Stdout)

	switch {
	case err != nil:
		check.Message = err.Error()
	case run.ExitCode != vc.ExitCode:
		check.Message = fmt.Sprintf("exit code %d, want %d", run.ExitCode, vc.ExitCode)
	case vc.Stdout != nil && stdout != *vc.Stdout:
		check.Message = fmt.Sprintf("stdout %q, want %q",
			textutil.Truncate(stdout, messageLimit), textutil.Truncate(*vc.Stdout, messageLimit))
	case vc.SHA256 != "" && sha256Hex(run.Stdout) != vc.SHA256:
		check.Message = fmt.Sprintf("stdout sha256 %s (%d bytes), want %s", sha256Hex(run.Stdout), len(run.Stdout), vc.SHA256)
	default:
		check.Passed = true
	}

	return check
}

func failedChecks(checks []CaseCheck) []string {
	var failed []string

	for _, check := range checks {
		if !check.Passed {
			failed = append(failed, check.Name+" ("+check.Message+")")
		}
	}

	return failed
}

func (o Orchestrator) measure(ctx context.Context, req measureRequest) CaseResult {
	bc := req.bench
	o.logf("    benchmark %s: %d warmup + %d runs", bc.ID, bc.Warmup, bc.Runs)
	args := []string{"-runs", strconv.Itoa(bc.Runs), "-warmup", strconv.Itoa(bc.Warmup), "-sha256", bc.SHA256, "--"}
	args = append(slices.Concat(args, req.entrypoint), bc.Args...)
	run, err := o.Docker.Run(ctx, docker.RunOptions{
		Image:      req.image,
		Args:       args,
		Entrypoint: harnessBin,
		Mounts:     []docker.Mount{{Source: req.opts.HarnessDir, Target: harnessMount, ReadOnly: true}},
		CPUSet:     req.opts.CPUSet,
	})

	if err != nil {
		return failedCase(bc.ID, err.Error())
	}

	if run.ExitCode != 0 {
		return failedCase(bc.ID, textutil.Truncate(strings.TrimSpace(string(run.Stderr)), 4*messageLimit))
	}

	var report measure.Report

	if err := json.Unmarshal(run.Stdout, &report); err != nil {
		return failedCase(bc.ID, "invalid harness report: "+err.Error())
	}

	result := caseFromReport(bc.ID, report)
	o.logf("      median wall %.3f ms, peak memory %.0f KiB", result.Stats.WallNs.Median/1e6, result.Stats.MaxRssKb.Median)
	return result
}

func sha256Hex(data []byte) string {
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}

// selectTargets applies the project/language filters; unknown names are an error.
func selectTargets(c *catalog.Catalog, opts Options) ([]target, error) {
	if err := checkKnown(opts.Projects, c.Projects, func(p catalog.Project) string { return p.ID }); err != nil {
		return nil, fmt.Errorf("project filter: %w", err)
	}

	if err := checkKnown(opts.Languages, c.Languages, func(l catalog.Language) string { return l.ID }); err != nil {
		return nil, fmt.Errorf("language filter: %w", err)
	}

	var targets []target

	for _, project := range c.Projects {
		for _, impl := range project.Implementations {
			if matches(opts.Projects, project.ID) && matches(opts.Languages, impl.Language) {
				targets = append(targets, target{project: project, impl: impl})
			}
		}
	}

	if len(targets) == 0 {
		return nil, fmt.Errorf("no implementation matches the filters")
	}

	return targets, nil
}

func matches(filter []string, id string) bool {
	return len(filter) == 0 || slices.Contains(filter, id)
}

func checkKnown[T any](filter []string, items []T, id func(T) string) error {
	for _, name := range filter {
		if !slices.ContainsFunc(items, func(item T) bool { return id(item) == name }) {
			return fmt.Errorf("unknown id %q", name)
		}
	}

	return nil
}
