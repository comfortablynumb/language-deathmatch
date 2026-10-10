package bench

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"testing"
	"time"

	"deathmatch/tools/internal/catalog"
	"deathmatch/tools/internal/docker"
	"deathmatch/tools/internal/execx"
	"deathmatch/tools/internal/measure"
)

const tenOutput = "0\n1\n1\n2\n3\n5\n8\n13\n21\n34\n"
const tenHash = "356f8e5349048d902084bc657340d5c36c8f8bfdd82d587fad79c7933f602ad5"

// fakeDocker answers like a working image whose program prints tenOutput for "10"
// and fails for anything else.
type fakeDocker struct {
	builds     []docker.BuildOptions
	runs       []docker.RunOptions
	buildErr   error
	stdout     string
	harnessOut string
	harnessErr string
}

func (f *fakeDocker) Build(_ context.Context, opts docker.BuildOptions) error {
	f.builds = append(f.builds, opts)
	return f.buildErr
}

func (f *fakeDocker) Inspect(context.Context, string) (docker.ImageInfo, error) {
	return docker.ImageInfo{Entrypoint: []string{"/app/fib"}, SizeBytes: 1000}, nil
}

func (f *fakeDocker) Run(_ context.Context, opts docker.RunOptions) (docker.RunResult, error) {
	f.runs = append(f.runs, opts)

	if opts.Entrypoint != "" {
		if f.harnessErr != "" {
			return docker.RunResult{ExitCode: 1, Stderr: []byte(f.harnessErr)}, nil
		}

		return docker.RunResult{Stdout: []byte(f.harnessOut)}, nil
	}

	if len(opts.Args) == 1 && opts.Args[0] == "10" {
		return docker.RunResult{Stdout: []byte(f.stdout)}, nil
	}

	return docker.RunResult{ExitCode: 1}, nil
}

func (f *fakeDocker) ServerVersion(context.Context) (string, error) { return "28.5.1", nil }

type fakeMeta struct{}

func (fakeMeta) Commit(context.Context) string { return "abc1234" }
func (fakeMeta) Runner() string                { return "local" }

type fixedClock struct{}

func (fixedClock) Now() time.Time { return time.Date(2026, 10, 8, 0, 0, 0, 0, time.UTC) }

func ptr(s string) *string { return &s }

func testCatalog() *catalog.Catalog {
	project := catalog.Project{
		ID: "fibonacci",
		Verify: []catalog.VerifyCase{
			{Name: "ten", Args: []string{"10"}, Stdout: ptr(tenOutput)},
			{Name: "ten hashed", Args: []string{"10"}, SHA256: tenHash},
			{Name: "bad", Args: []string{"x"}, ExitCode: 1, Stdout: ptr("")},
		},
		Benchmarks:      []catalog.BenchmarkCase{{ID: "startup", Args: []string{"10"}, Runs: 2, SHA256: tenHash}},
		Implementations: []catalog.Implementation{{Language: "go"}, {Language: "python"}},
	}

	return &catalog.Catalog{
		Languages: []catalog.Language{{ID: "go"}, {ID: "python"}},
		Projects:  []catalog.Project{project},
	}
}

func harnessReport() string {
	report := measure.Report{
		Samples:  []measure.Sample{{WallNs: 100, UserNs: 10, SysNs: 5, MaxRssKb: 1}, {WallNs: 300, UserNs: 20, SysNs: 5, MaxRssKb: 1}},
		MemoryKb: []int64{900, 1100, 1000},
		Host:     measure.HostInfo{CPUModel: "CPU", CPUs: 4, Kernel: "6.8", Arch: "amd64"},
	}
	data, _ := json.Marshal(report)
	return string(data)
}

func newOrchestrator(d *fakeDocker) Orchestrator {
	return Orchestrator{Docker: d, Meta: fakeMeta{}, Clock: fixedClock{}, Log: io.Discard}
}

func TestRunMeasuresEveryImplementation(t *testing.T) {
	d := &fakeDocker{stdout: tenOutput, harnessOut: harnessReport()}
	results, err := newOrchestrator(d).Run(context.Background(), testCatalog(), Options{Root: "/repo", HarnessDir: "/h"})

	if err != nil {
		t.Fatalf("Run: %v", err)
	}

	if len(results.Results) != 2 || results.FailedCount() != 0 {
		t.Fatalf("results = %+v", results.Results)
	}

	bc := results.Results[0].Benchmarks[0]

	if bc.Stats.WallNs.Median != 200 || bc.Samples.CPUNs[1] != 25 || bc.Stats.MaxRssKb.Median != 1000 {
		t.Fatalf("case result = %+v", bc)
	}

	env := results.Environment

	if env.CPUs != 4 || env.Docker != "28.5.1" || env.Runner != "local" || results.Commit != "abc1234" {
		t.Fatalf("environment = %+v, commit %q", env, results.Commit)
	}

	if d.builds[0].Target != "harness" || d.builds[0].OutputDir != "/h" {
		t.Fatalf("first build should export the harness: %+v", d.builds[0])
	}
}

func TestRunPassesHarnessArguments(t *testing.T) {
	d := &fakeDocker{stdout: tenOutput, harnessOut: harnessReport()}
	opts := Options{Root: "/repo", HarnessDir: "/h", CPUSet: "1", Languages: []string{"go"}}

	if _, err := newOrchestrator(d).Run(context.Background(), testCatalog(), opts); err != nil {
		t.Fatalf("Run: %v", err)
	}

	last := d.runs[len(d.runs)-1]
	want := "-runs 2 -warmup 0 -sha256 " + tenHash + " -- /app/fib 10"

	if got := strings.Join(last.Args, " "); got != want || last.Entrypoint != harnessBin || last.CPUSet != "1" {
		t.Fatalf("harness run = %+v, args %q", last, got)
	}

	if last.Mounts[0].Source != "/h" || !last.Mounts[0].ReadOnly {
		t.Fatalf("mounts = %+v", last.Mounts)
	}
}

func TestRunVerifyOnlySkipsHarness(t *testing.T) {
	d := &fakeDocker{stdout: tenOutput}
	results, err := newOrchestrator(d).Run(context.Background(), testCatalog(), Options{VerifyOnly: true})

	if err != nil || results.FailedCount() != 0 {
		t.Fatalf("Run = %+v, %v", results, err)
	}

	for _, build := range d.builds {
		if build.Target == "harness" {
			t.Fatal("verify-only run built the harness")
		}
	}

	if len(results.Results[0].Benchmarks) != 0 || len(results.Results[0].Verification) != 3 {
		t.Fatalf("result = %+v", results.Results[0])
	}
}

func TestRunMarksWrongOutputAsFailed(t *testing.T) {
	d := &fakeDocker{stdout: "0\n1\n", harnessOut: harnessReport()}
	results, _ := newOrchestrator(d).Run(context.Background(), testCatalog(), Options{HarnessDir: "/h"})

	result := results.Results[0]

	if result.Status != StatusFailed || !strings.Contains(result.Error, "verification failed: ten (stdout") {
		t.Fatalf("result = %+v", result)
	}

	if len(result.Benchmarks) != 0 || results.FailedCount() != 2 {
		t.Fatalf("failed implementation should not be benchmarked: %+v", result)
	}
}

func TestRunReportsHarnessFailure(t *testing.T) {
	d := &fakeDocker{stdout: tenOutput, harnessErr: "ldmmeasure: output sha256 mismatch"}
	results, _ := newOrchestrator(d).Run(context.Background(), testCatalog(), Options{HarnessDir: "/h"})

	result := results.Results[0]

	if result.Status != StatusFailed || !strings.Contains(result.Error, "benchmark startup: ldmmeasure: output sha256 mismatch") {
		t.Fatalf("result = %+v", result)
	}
}

func TestRunReportsBuildFailure(t *testing.T) {
	d := &fakeDocker{buildErr: errors.New("docker build exited with code 1")}
	results, err := newOrchestrator(d).Run(context.Background(), testCatalog(), Options{VerifyOnly: true})

	if err != nil || results.FailedCount() != 2 || results.Results[0].Error != "docker build exited with code 1" {
		t.Fatalf("Run = %+v, %v", results, err)
	}
}

func TestRunRejectsUnknownFilter(t *testing.T) {
	_, err := newOrchestrator(&fakeDocker{}).Run(context.Background(), testCatalog(), Options{Languages: []string{"cobol"}})

	if err == nil || !strings.Contains(err.Error(), `unknown id "cobol"`) {
		t.Fatalf("err = %v, want unknown filter error", err)
	}
}

type mapEnv map[string]string

func (m mapEnv) Getenv(key string) string { return m[key] }

type gitRunner struct{ out string }

func (g gitRunner) Run(_ context.Context, cmd execx.Command) (int, error) {
	io.WriteString(cmd.Stdout, g.out)
	return 0, nil
}

func TestEnvMeta(t *testing.T) {
	ci := EnvMeta{Env: mapEnv{"GITHUB_SHA": "0123456789abcdef", "GITHUB_ACTIONS": "true"}, Git: gitRunner{}}

	if ci.Commit(context.Background()) != "0123456" || ci.Runner() != "github-actions" {
		t.Fatalf("CI meta = %q, %q", ci.Commit(context.Background()), ci.Runner())
	}

	local := EnvMeta{Env: mapEnv{}, Git: gitRunner{out: "fedcba9876543210\n"}}

	if local.Commit(context.Background()) != "fedcba9" || local.Runner() != "local" {
		t.Fatalf("local meta = %q, %q", local.Commit(context.Background()), local.Runner())
	}
}
