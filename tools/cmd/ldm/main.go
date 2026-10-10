// Command ldm is the Language Deathmatch host CLI:
//
//	ldm catalog  validate manifests and generate site/data
//	ldm bench    build, verify and benchmark implementations in Docker
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"

	"deathmatch/tools/internal/bench"
	"deathmatch/tools/internal/cli"
	"deathmatch/tools/internal/docker"
	"deathmatch/tools/internal/execx"
	"deathmatch/tools/internal/jsonio"
	"deathmatch/tools/internal/sitegen"
)

const usage = "usage: ldm <catalog|bench> [flags]  (ldm <command> -h for flags)"

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	if err := run(ctx, os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "ldm:", err)
		stop()
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("%s", usage)
	}

	switch args[0] {
	case "catalog":
		return runCatalog(args[1:])
	case "bench":
		return runBench(ctx, args[1:])
	default:
		return fmt.Errorf("unknown command %q\n%s", args[0], usage)
	}
}

func runCatalog(args []string) error {
	cfg, err := cli.ParseCatalogConfig(args, os.Stderr)

	if err != nil {
		return err
	}

	deps := cli.CatalogDeps{Source: os.DirFS(cfg.Root), Output: jsonio.FileWriter{}, Clock: sitegen.SystemClock{}, Log: os.Stderr}
	return cli.RunCatalog(cfg, deps)
}

func runBench(ctx context.Context, args []string) error {
	cfg, err := cli.ParseBenchConfig(args, os.Stderr)

	if err != nil {
		return err
	}

	runner := execx.OSRunner{}
	deps := cli.BenchDeps{
		Source: os.DirFS(cfg.Root),
		Output: jsonio.FileWriter{},
		Docker: docker.CLI{Runner: runner, Log: os.Stderr},
		Meta:   bench.EnvMeta{Env: bench.OSEnv{}, Git: runner, Root: cfg.Root},
		Clock:  sitegen.SystemClock{},
		Log:    os.Stderr,
	}

	return cli.RunBench(ctx, cfg, deps)
}
