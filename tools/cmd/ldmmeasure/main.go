// Command ldmmeasure is the in-container benchmark harness:
//
//	ldmmeasure [-runs N] [-warmup N] [-timeout D] [-sha256 HEX] [-launcher PATH] -- command [args...]
//
// It prints a JSON report (samples + host info) on stdout.
package main

import (
	"context"
	"fmt"
	"os"
	"runtime"

	"deathmatch/tools/internal/measure"
)

func main() {
	cfg, err := measure.ParseConfig(os.Args[1:], os.Stderr)

	if err != nil {
		fmt.Fprintln(os.Stderr, "ldmmeasure:", err)
		os.Exit(2)
	}

	harness := measure.Harness{
		Process: measure.OSProcess{Launcher: cfg.Launcher},
		Host:    measure.ProcHostProbe{Root: os.DirFS("/"), Arch: runtime.GOARCH},
	}

	if err := harness.MeasureTo(context.Background(), cfg, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "ldmmeasure:", err)
		os.Exit(1)
	}
}
