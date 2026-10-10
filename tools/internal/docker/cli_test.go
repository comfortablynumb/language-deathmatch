package docker

import (
	"context"
	"errors"
	"io"
	"slices"
	"strings"
	"testing"

	"deathmatch/tools/internal/execx"
)

// fakeRunner records commands and replies with scripted output.
type fakeRunner struct {
	commands [][]string
	stdout   string
	stderr   string
	code     int
	err      error
}

func (f *fakeRunner) Run(_ context.Context, cmd execx.Command) (int, error) {
	f.commands = append(f.commands, append([]string{cmd.Name}, cmd.Args...))
	io.WriteString(cmd.Stdout, f.stdout)
	io.WriteString(cmd.Stderr, f.stderr)
	return f.code, f.err
}

func TestBuildArgs(t *testing.T) {
	got := BuildArgs(BuildOptions{ContextDir: "tools", Target: "harness", OutputDir: "/out"})
	want := []string{"build", "--platform", Platform, "--target", "harness", "--output", "type=local,dest=/out", "tools"}

	if !slices.Equal(got, want) {
		t.Fatalf("BuildArgs = %v, want %v", got, want)
	}
}

func TestRunArgs(t *testing.T) {
	got := RunArgs(RunOptions{
		Image: "img", Args: []string{"-runs", "3"}, Entrypoint: "/ldm/ldmmeasure", CPUSet: "1",
		Mounts: []Mount{{Source: "/h", Target: "/ldm", ReadOnly: true}},
	})
	want := []string{"run", "--rm", "--network", "none", "--platform", Platform, "--cpuset-cpus", "1",
		"--mount", "type=bind,source=/h,target=/ldm,readonly", "--entrypoint", "/ldm/ldmmeasure", "img", "-runs", "3"}

	if !slices.Equal(got, want) {
		t.Fatalf("RunArgs = %v, want %v", got, want)
	}
}

func TestParseInspect(t *testing.T) {
	info, err := ParseInspect([]byte(`[{"Size": 42, "Config": {"Entrypoint": ["python3", "/app/main.py"], "Cmd": null}}]`))

	if err != nil || strings.Join(info.Entrypoint, " ") != "python3 /app/main.py" {
		t.Fatalf("ParseInspect = %+v, %v", info, err)
	}

	if _, err := ParseInspect([]byte(`[]`)); err == nil {
		t.Fatal("ParseInspect of empty list succeeded")
	}
}

func TestSumLayerSizes(t *testing.T) {
	total, err := SumLayerSizes("8192\n0\n12288\n")

	if err != nil || total != 20480 {
		t.Fatalf("SumLayerSizes = %d, %v", total, err)
	}

	if _, err := SumLayerSizes("12kB\n"); err == nil {
		t.Fatal("SumLayerSizes accepted a human-readable size")
	}
}

func TestInspectSumsHistory(t *testing.T) {
	runner := &scriptedRunner{outputs: []string{`[{"Config": {"Entrypoint": ["/app/fib"]}}]`, "100\n200\n"}}
	info, err := CLI{Runner: runner, Log: io.Discard}.Inspect(context.Background(), "img")

	if err != nil || info.SizeBytes != 300 || info.Entrypoint[0] != "/app/fib" {
		t.Fatalf("Inspect = %+v, %v", info, err)
	}

	if runner.commands[1][1] != "history" {
		t.Fatalf("second command = %v, want docker history", runner.commands[1])
	}
}

// scriptedRunner replies with one stdout per call, in order.
type scriptedRunner struct {
	outputs  []string
	commands [][]string
}

func (s *scriptedRunner) Run(_ context.Context, cmd execx.Command) (int, error) {
	s.commands = append(s.commands, append([]string{cmd.Name}, cmd.Args...))
	io.WriteString(cmd.Stdout, s.outputs[len(s.commands)-1])
	return 0, nil
}

func TestRunCapturesOutputAndExitCode(t *testing.T) {
	runner := &fakeRunner{stdout: "out", stderr: "err", code: 1}
	result, err := CLI{Runner: runner, Log: io.Discard}.Run(context.Background(), RunOptions{Image: "img"})

	if err != nil || result.ExitCode != 1 || string(result.Stdout) != "out" || string(result.Stderr) != "err" {
		t.Fatalf("Run = %+v, %v", result, err)
	}
}

func TestCheckFailsOnNonZeroExit(t *testing.T) {
	runner := &fakeRunner{stderr: "step 1\nno such image\n", code: 1}
	_, err := CLI{Runner: runner, Log: io.Discard}.Inspect(context.Background(), "img")

	if err == nil || !strings.HasSuffix(err.Error(), "no such image") {
		t.Fatalf("err = %v, want last stderr line", err)
	}
}

func TestServerVersion(t *testing.T) {
	runner := &fakeRunner{stdout: "28.5.1\n"}
	version, err := CLI{Runner: runner, Log: io.Discard}.ServerVersion(context.Background())

	if err != nil || version != "28.5.1" {
		t.Fatalf("ServerVersion = %q, %v", version, err)
	}
}

func TestRunPropagatesStartError(t *testing.T) {
	runner := &fakeRunner{err: errors.New("docker not found")}

	if _, err := (CLI{Runner: runner, Log: io.Discard}).Run(context.Background(), RunOptions{Image: "x"}); err == nil {
		t.Fatal("Run succeeded, want error")
	}
}
