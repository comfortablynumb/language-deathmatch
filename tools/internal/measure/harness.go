package measure

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

const stderrLimit = 2048

// Harness runs the benchmark protocol for one case.
type Harness struct {
	Process Process
	Host    HostProbe
}

// Measure verifies the program output, runs the warmups and collects the timed samples.
func (h Harness) Measure(ctx context.Context, cfg Config) (Report, error) {
	output, err := h.verify(ctx, cfg)

	if err != nil {
		return Report{}, err
	}

	for i := range cfg.Warmup {
		if _, err := h.timedRun(ctx, cfg); err != nil {
			return Report{}, fmt.Errorf("warmup run %d: %w", i+1, err)
		}
	}

	samples := make([]Sample, 0, cfg.Runs)

	for i := range cfg.Runs {
		sample, err := h.timedRun(ctx, cfg)

		if err != nil {
			return Report{}, fmt.Errorf("timed run %d: %w", i+1, err)
		}

		samples = append(samples, sample)
	}

	memory, err := h.memoryRuns(ctx, cfg)

	if err != nil {
		return Report{}, err
	}

	return Report{Output: output, Samples: samples, MemoryKb: memory, Host: h.Host.Probe()}, nil
}

// memoryRuns traces untimed runs to measure exact peak memory.
func (h Harness) memoryRuns(ctx context.Context, cfg Config) ([]int64, error) {
	memory := make([]int64, 0, cfg.MemoryRuns)

	for i := range cfg.MemoryRuns {
		sample, err := h.run(ctx, RunSpec{Command: cfg.Command, Timeout: cfg.Timeout, Memory: true})

		if err != nil {
			return nil, fmt.Errorf("memory run %d: %w", i+1, err)
		}

		memory = append(memory, sample.MaxRssKb)
	}

	return memory, nil
}

// MeasureTo runs Measure and writes the report as JSON to w.
func (h Harness) MeasureTo(ctx context.Context, cfg Config, w io.Writer) error {
	report, err := h.Measure(ctx, cfg)

	if err != nil {
		return err
	}

	return json.NewEncoder(w).Encode(report)
}

// verify runs the program once, hashing stdout, and compares the digest.
func (h Harness) verify(ctx context.Context, cfg Config) (OutputCheck, error) {
	hasher := sha256.New()
	stdout := &countingWriter{target: hasher}
	stderr := &cappedBuffer{limit: stderrLimit}
	spec := RunSpec{Command: cfg.Command, Stdout: stdout, Stderr: stderr, Timeout: cfg.Timeout}
	result, err := h.Process.Run(ctx, spec)

	if err != nil {
		return OutputCheck{}, fmt.Errorf("verification run: %w", err)
	}

	if result.ExitCode != 0 {
		return OutputCheck{}, fmt.Errorf("verification run exited with code %d: %s",
			result.ExitCode, strings.TrimSpace(stderr.String()))
	}

	check := OutputCheck{SHA256: hex.EncodeToString(hasher.Sum(nil)), Bytes: stdout.count}

	if cfg.SHA256 != "" && check.SHA256 != cfg.SHA256 {
		return OutputCheck{}, fmt.Errorf("output sha256 %s (%d bytes) does not match expected %s",
			check.SHA256, check.Bytes, cfg.SHA256)
	}

	return check, nil
}

// timedRun runs the program with output discarded and returns its measurement.
func (h Harness) timedRun(ctx context.Context, cfg Config) (Sample, error) {
	return h.run(ctx, RunSpec{Command: cfg.Command, Timeout: cfg.Timeout})
}

// run executes one run and requires a zero exit code.
func (h Harness) run(ctx context.Context, spec RunSpec) (Sample, error) {
	result, err := h.Process.Run(ctx, spec)

	if err != nil {
		return Sample{}, err
	}

	if result.ExitCode != 0 {
		return Sample{}, fmt.Errorf("exited with code %d", result.ExitCode)
	}

	return result.Sample, nil
}

// countingWriter forwards writes and counts bytes.
type countingWriter struct {
	target io.Writer
	count  int64
}

func (w *countingWriter) Write(p []byte) (int, error) {
	n, err := w.target.Write(p)
	w.count += int64(n)
	return n, err
}

// cappedBuffer keeps the first limit bytes written to it and silently drops the rest.
type cappedBuffer struct {
	limit int
	data  []byte
}

func (b *cappedBuffer) Write(p []byte) (int, error) {
	room := b.limit - len(b.data)

	if room > 0 {
		b.data = append(b.data, p[:min(room, len(p))]...)
	}

	return len(p), nil
}

func (b *cappedBuffer) String() string {
	return string(b.data)
}
