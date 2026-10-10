// Package measure implements ldmmeasure, the harness that runs inside a benchmark
// container: one verification run, warmups, then timed runs of the program.
package measure

import (
	"context"
	"io"
	"time"
)

// Sample is the measurement of one run as reported by ldmexec. MaxRssKb is only exact
// for memory runs (RunSpec.Memory); timed runs use the kernel's approximate counters.
type Sample struct {
	WallNs   int64 `json:"wallNs"`
	UserNs   int64 `json:"userNs"`
	SysNs    int64 `json:"sysNs"`
	MaxRssKb int64 `json:"maxRssKb"`
}

// RunSpec describes one execution of the measured program.
type RunSpec struct {
	Command []string
	Stdout  io.Writer // nil discards output (/dev/null)
	Stderr  io.Writer // nil discards output (/dev/null)
	Timeout time.Duration
	Memory  bool // trace the run to measure exact peak memory (adds overhead; never timed)
}

// RunResult is the outcome of one execution.
type RunResult struct {
	ExitCode int
	Sample   Sample
}

// Process executes the measured program once.
type Process interface {
	Run(ctx context.Context, spec RunSpec) (RunResult, error)
}

// HostInfo describes the machine the benchmark ran on.
type HostInfo struct {
	CPUModel string `json:"cpuModel"`
	CPUs     int    `json:"cpus"`
	Kernel   string `json:"kernel"`
	Arch     string `json:"arch"`
}

// HostProbe reports information about the host.
type HostProbe interface {
	Probe() HostInfo
}

// Config is the harness configuration (from command-line flags).
type Config struct {
	Runs       int
	Warmup     int
	MemoryRuns int
	Timeout    time.Duration
	SHA256     string
	Launcher   string
	Command    []string
}

// OutputCheck is the result of the verification run.
type OutputCheck struct {
	SHA256 string `json:"sha256"`
	Bytes  int64  `json:"bytes"`
}

// Report is the JSON document printed by ldmmeasure: timed samples (wall/CPU time) and
// peak memory per memory run.
type Report struct {
	Output   OutputCheck `json:"output"`
	Samples  []Sample    `json:"samples"`
	MemoryKb []int64     `json:"memoryKb"`
	Host     HostInfo    `json:"host"`
}
