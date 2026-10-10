package measure

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"
	"testing/fstest"
)

// fakeProcess writes a fixed stdout and returns scripted results in order.
type fakeProcess struct {
	stdout  string
	stderr  string
	results []RunResult
	err     error
	calls   int
	piped   int // runs that received a stdout writer
	traced  int // runs in memory mode
}

func (f *fakeProcess) Run(_ context.Context, spec RunSpec) (RunResult, error) {
	if f.err != nil {
		return RunResult{}, f.err
	}

	if spec.Memory {
		f.traced++
	}

	if spec.Stdout != nil {
		f.piped++
		io.WriteString(spec.Stdout, f.stdout)
	}

	if spec.Stderr != nil {
		io.WriteString(spec.Stderr, f.stderr)
	}

	result := f.results[min(f.calls, len(f.results)-1)]
	f.calls++
	return result, nil
}

type fakeHost struct{}

func (fakeHost) Probe() HostInfo { return HostInfo{CPUModel: "Test CPU", CPUs: 2, Arch: "amd64"} }

// sha256 of "0\n1\n1\n2\n3\n5\n8\n13\n21\n34\n"
const tenHash = "356f8e5349048d902084bc657340d5c36c8f8bfdd82d587fad79c7933f602ad5"
const tenOutput = "0\n1\n1\n2\n3\n5\n8\n13\n21\n34\n"

func okResult(wall int64) RunResult {
	return RunResult{Sample: Sample{WallNs: wall, UserNs: 1, SysNs: 2, MaxRssKb: 3}}
}

func TestMeasureCollectsSamples(t *testing.T) {
	memory := RunResult{Sample: Sample{WallNs: 999, MaxRssKb: 64}}
	process := &fakeProcess{stdout: tenOutput, results: []RunResult{okResult(10), okResult(20), okResult(30), okResult(40), memory}}
	h := Harness{Process: process, Host: fakeHost{}}
	cfg := Config{Runs: 2, Warmup: 1, MemoryRuns: 2, SHA256: tenHash, Command: []string{"fib"}}

	report, err := h.Measure(context.Background(), cfg)

	if err != nil {
		t.Fatalf("Measure: %v", err)
	}

	if process.calls != 6 || process.piped != 1 || process.traced != 2 {
		t.Fatalf("calls = %d, piped = %d, traced = %d; want 1 verification + 1 warmup + 2 timed + 2 memory runs",
			process.calls, process.piped, process.traced)
	}

	if len(report.MemoryKb) != 2 || report.MemoryKb[0] != 64 {
		t.Fatalf("memory = %v, want samples from the memory runs", report.MemoryKb)
	}

	if len(report.Samples) != 2 || report.Samples[0].WallNs != 30 || report.Samples[1].WallNs != 40 {
		t.Fatalf("samples = %+v, want the two timed runs", report.Samples)
	}

	if report.Output.Bytes != int64(len(tenOutput)) || report.Host.CPUModel != "Test CPU" {
		t.Fatalf("report = %+v", report)
	}
}

func TestMeasureRejectsWrongOutput(t *testing.T) {
	process := &fakeProcess{stdout: "wrong\n", results: []RunResult{okResult(1)}}
	h := Harness{Process: process, Host: fakeHost{}}

	_, err := h.Measure(context.Background(), Config{Runs: 1, SHA256: tenHash, Command: []string{"fib"}})

	if err == nil || !strings.Contains(err.Error(), "does not match expected") {
		t.Fatalf("err = %v, want sha256 mismatch", err)
	}
}

func TestMeasureReportsVerificationExitCode(t *testing.T) {
	process := &fakeProcess{stderr: "boom", results: []RunResult{{ExitCode: 3}}}
	h := Harness{Process: process, Host: fakeHost{}}

	_, err := h.Measure(context.Background(), Config{Runs: 1, Command: []string{"fib"}})

	if err == nil || !strings.Contains(err.Error(), "code 3: boom") {
		t.Fatalf("err = %v, want exit code and stderr", err)
	}
}

func TestMeasureFailsOnTimedRunExitCode(t *testing.T) {
	process := &fakeProcess{stdout: tenOutput, results: []RunResult{okResult(1), {ExitCode: 9}}}
	h := Harness{Process: process, Host: fakeHost{}}

	_, err := h.Measure(context.Background(), Config{Runs: 1, Command: []string{"fib"}})

	if err == nil || !strings.Contains(err.Error(), "timed run 1: exited with code 9") {
		t.Fatalf("err = %v, want timed run failure", err)
	}
}

func TestMeasurePropagatesProcessError(t *testing.T) {
	h := Harness{Process: &fakeProcess{err: errors.New("timed out")}, Host: fakeHost{}}

	if _, err := h.Measure(context.Background(), Config{Runs: 1, Command: []string{"x"}}); err == nil {
		t.Fatal("Measure succeeded, want error")
	}
}

func TestLauncherArgs(t *testing.T) {
	if got := launcherArgs(RunSpec{Command: []string{"fib", "10"}, Memory: true}); strings.Join(got, " ") != "-m fib 10" {
		t.Fatalf("memory mode args = %v", got)
	}

	if got := launcherArgs(RunSpec{Command: []string{"fib"}}); strings.Join(got, " ") != "fib" {
		t.Fatalf("timed mode args = %v", got)
	}
}

func TestParseLauncherStats(t *testing.T) {
	got, err := ParseLauncherStats("0 1500 700 300 1024\n")

	want := RunResult{ExitCode: 0, Sample: Sample{WallNs: 1500, UserNs: 700, SysNs: 300, MaxRssKb: 1024}}

	if err != nil || got != want {
		t.Fatalf("ParseLauncherStats = %+v, %v; want %+v", got, err, want)
	}

	for _, bad := range []string{"", "1 2 3 4", "a b c d e"} {
		if _, err := ParseLauncherStats(bad); err == nil {
			t.Errorf("ParseLauncherStats(%q) succeeded, want error", bad)
		}
	}
}

func TestCappedBuffer(t *testing.T) {
	b := &cappedBuffer{limit: 4}
	n, _ := b.Write([]byte("abcdef"))

	if n != 6 || b.String() != "abcd" {
		t.Fatalf("n = %d, content = %q", n, b.String())
	}
}

func TestProcHostProbe(t *testing.T) {
	root := fstest.MapFS{
		"proc/cpuinfo":              {Data: []byte("processor\t: 0\nmodel name\t: AMD EPYC 7763\nprocessor\t: 1\nmodel name\t: AMD EPYC 7763\n")},
		"proc/sys/kernel/osrelease": {Data: []byte("6.8.0-1014-azure\n")},
	}

	got := ProcHostProbe{Root: root, Arch: "amd64"}.Probe()

	want := HostInfo{CPUModel: "AMD EPYC 7763", CPUs: 2, Kernel: "6.8.0-1014-azure", Arch: "amd64"}

	if got != want {
		t.Fatalf("Probe = %+v, want %+v", got, want)
	}
}

func TestParseConfig(t *testing.T) {
	cfg, err := ParseConfig([]string{"-runs", "5", "-warmup", "0", "--", "python3", "main.py", "10"}, io.Discard)

	if err != nil || cfg.Runs != 5 || cfg.Warmup != 0 || strings.Join(cfg.Command, " ") != "python3 main.py 10" {
		t.Fatalf("ParseConfig = %+v, %v", cfg, err)
	}

	if _, err := ParseConfig([]string{"-runs", "1"}, io.Discard); err == nil {
		t.Fatal("ParseConfig without command succeeded")
	}

	if _, err := ParseConfig([]string{"-runs", "0", "--", "x"}, io.Discard); err == nil {
		t.Fatal("ParseConfig with runs=0 succeeded")
	}
}
