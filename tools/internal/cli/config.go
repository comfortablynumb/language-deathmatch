// Package cli parses the ldm subcommand flags and runs the subcommands.
package cli

import (
	"flag"
	"io"
	"path/filepath"
	"strings"
)

// CatalogConfig configures `ldm catalog`.
type CatalogConfig struct {
	Root   string
	OutDir string
}

// BenchConfig configures `ldm bench`.
type BenchConfig struct {
	Root       string
	Out        string
	HarnessDir string
	Projects   []string
	Languages  []string
	VerifyOnly bool
	CPUSet     string
}

// ParseCatalogConfig parses `ldm catalog` flags.
func ParseCatalogConfig(args []string, output io.Writer) (CatalogConfig, error) {
	flags := newFlagSet("ldm catalog", output)
	cfg := CatalogConfig{}
	flags.StringVar(&cfg.Root, "root", ".", "repository root")
	flags.StringVar(&cfg.OutDir, "out", "site/data", "output directory for site data")

	if err := flags.Parse(args); err != nil {
		return CatalogConfig{}, err
	}

	root, err := filepath.Abs(cfg.Root)
	cfg.Root = root
	return cfg, err
}

// ParseBenchConfig parses `ldm bench` flags. Paths are made absolute because they are
// passed to docker as build contexts and bind mounts.
func ParseBenchConfig(args []string, output io.Writer) (BenchConfig, error) {
	flags := newFlagSet("ldm bench", output)
	cfg := BenchConfig{}
	var projects, languages string
	flags.StringVar(&cfg.Root, "root", ".", "repository root")
	flags.StringVar(&cfg.Out, "out", "site/data/results.json", "results file")
	flags.StringVar(&cfg.HarnessDir, "harness", "build/harness", "directory receiving the in-container harness")
	flags.StringVar(&projects, "project", "", "comma-separated project ids (default: all)")
	flags.StringVar(&languages, "lang", "", "comma-separated language ids (default: all)")
	flags.BoolVar(&cfg.VerifyOnly, "verify-only", false, "build and verify only, no measurements")
	flags.StringVar(&cfg.CPUSet, "cpuset", "", "pin benchmark containers to these CPUs (docker --cpuset-cpus)")

	if err := flags.Parse(args); err != nil {
		return BenchConfig{}, err
	}

	cfg.Projects = SplitList(projects)
	cfg.Languages = SplitList(languages)
	return absolutize(cfg)
}

func absolutize(cfg BenchConfig) (BenchConfig, error) {
	var err error

	if cfg.Root, err = filepath.Abs(cfg.Root); err != nil {
		return BenchConfig{}, err
	}

	if cfg.HarnessDir, err = filepath.Abs(cfg.HarnessDir); err != nil {
		return BenchConfig{}, err
	}

	return cfg, nil
}

// SplitList splits a comma-separated list, trimming spaces and dropping empty items.
func SplitList(value string) []string {
	var items []string

	for item := range strings.SplitSeq(value, ",") {
		if item = strings.TrimSpace(item); item != "" {
			items = append(items, item)
		}
	}

	return items
}

func newFlagSet(name string, output io.Writer) *flag.FlagSet {
	flags := flag.NewFlagSet(name, flag.ContinueOnError)
	flags.SetOutput(output)
	return flags
}
