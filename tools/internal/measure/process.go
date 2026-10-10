package measure

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// OSProcess runs the program through the ldmexec launcher, which reports wall time,
// CPU time and peak RSS on file descriptor 3.
type OSProcess struct {
	Launcher string
}

// Run implements Process.
func (p OSProcess) Run(ctx context.Context, spec RunSpec) (RunResult, error) {
	if len(spec.Command) == 0 {
		return RunResult{}, errors.New("empty command")
	}

	ctx, cancel := context.WithTimeout(ctx, spec.Timeout)
	defer cancel()

	statsReader, statsWriter, err := os.Pipe()

	if err != nil {
		return RunResult{}, fmt.Errorf("stats pipe: %w", err)
	}

	defer statsReader.Close()

	cmd := exec.CommandContext(ctx, p.Launcher, launcherArgs(spec)...)
	cmd.Stdout = spec.Stdout
	cmd.Stderr = spec.Stderr
	cmd.ExtraFiles = []*os.File{statsWriter} // becomes fd 3 in ldmexec
	cmd.WaitDelay = time.Second
	runErr := cmd.Run()
	statsWriter.Close()

	if ctx.Err() != nil {
		return RunResult{}, fmt.Errorf("timed out after %s", spec.Timeout)
	}

	var exitErr *exec.ExitError

	if runErr != nil && !errors.As(runErr, &exitErr) {
		return RunResult{}, fmt.Errorf("launch %s: %w", p.Launcher, runErr)
	}

	line, err := io.ReadAll(statsReader)

	if err != nil {
		return RunResult{}, fmt.Errorf("read launcher stats: %w", err)
	}

	return ParseLauncherStats(string(line))
}

func launcherArgs(spec RunSpec) []string {
	if spec.Memory {
		return append([]string{"-m"}, spec.Command...)
	}

	return spec.Command
}

// ParseLauncherStats parses "<exit> <wall-ns> <user-ns> <sys-ns> <maxrss-kib>".
func ParseLauncherStats(line string) (RunResult, error) {
	fields := strings.Fields(line)

	if len(fields) != 5 {
		return RunResult{}, fmt.Errorf("launcher stats %q: want 5 fields", line)
	}

	values := make([]int64, len(fields))

	for i, field := range fields {
		value, err := strconv.ParseInt(field, 10, 64)

		if err != nil {
			return RunResult{}, fmt.Errorf("launcher stats %q: %w", line, err)
		}

		values[i] = value
	}

	return RunResult{
		ExitCode: int(values[0]),
		Sample:   Sample{WallNs: values[1], UserNs: values[2], SysNs: values[3], MaxRssKb: values[4]},
	}, nil
}
