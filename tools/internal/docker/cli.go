package docker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"

	"deathmatch/tools/internal/execx"
)

// CLI implements Client by invoking the docker command.
type CLI struct {
	Runner execx.Runner
	Log    io.Writer // receives build output
}

// Build implements Client.
func (c CLI) Build(ctx context.Context, opts BuildOptions) error {
	_, err := c.check(ctx, BuildArgs(opts), c.Log)
	return err
}

// Inspect implements Client. The size is the sum of the uncompressed layer sizes from
// `docker history`, because `docker image inspect` reports compressed sizes with the
// containerd image store and uncompressed sizes with overlay2.
func (c CLI) Inspect(ctx context.Context, image string) (ImageInfo, error) {
	out, err := c.check(ctx, []string{"image", "inspect", image}, io.Discard)

	if err != nil {
		return ImageInfo{}, err
	}

	info, err := ParseInspect(out)

	if err != nil {
		return ImageInfo{}, err
	}

	history, err := c.check(ctx, []string{"history", "--no-trunc", "--human=false", "--format", "{{.Size}}", image}, io.Discard)

	if err != nil {
		return ImageInfo{}, err
	}

	info.SizeBytes, err = SumLayerSizes(string(history))
	return info, err
}

// SumLayerSizes adds the per-layer byte counts printed by `docker history --human=false`.
func SumLayerSizes(history string) (int64, error) {
	var total int64

	for _, field := range strings.Fields(history) {
		size, err := strconv.ParseInt(field, 10, 64)

		if err != nil {
			return 0, fmt.Errorf("parse docker history size %q: %w", field, err)
		}

		total += size
	}

	return total, nil
}

// Run implements Client. A non-zero exit code of the container is not an error.
func (c CLI) Run(ctx context.Context, opts RunOptions) (RunResult, error) {
	var stdout, stderr bytes.Buffer
	cmd := execx.Command{Name: "docker", Args: RunArgs(opts), Stdout: &stdout, Stderr: &stderr}
	code, err := c.Runner.Run(ctx, cmd)

	if err != nil {
		return RunResult{}, fmt.Errorf("docker run %s: %w", opts.Image, err)
	}

	return RunResult{ExitCode: code, Stdout: stdout.Bytes(), Stderr: stderr.Bytes()}, nil
}

// ServerVersion implements Client.
func (c CLI) ServerVersion(ctx context.Context) (string, error) {
	out, err := c.check(ctx, []string{"version", "--format", "{{.Server.Version}}"}, io.Discard)
	return strings.TrimSpace(string(out)), err
}

// check runs docker with args and fails on a non-zero exit code.
func (c CLI) check(ctx context.Context, args []string, stderr io.Writer) ([]byte, error) {
	var stdout, errOut bytes.Buffer
	cmd := execx.Command{Name: "docker", Args: args, Stdout: &stdout, Stderr: io.MultiWriter(stderr, &errOut)}
	code, err := c.Runner.Run(ctx, cmd)

	if err != nil {
		return nil, fmt.Errorf("docker %s: %w", args[0], err)
	}

	if code != 0 {
		return nil, fmt.Errorf("docker %s exited with code %d: %s", strings.Join(args, " "), code,
			lastLine(errOut.String()))
	}

	return stdout.Bytes(), nil
}

// BuildArgs returns the docker arguments for a build.
func BuildArgs(opts BuildOptions) []string {
	args := []string{"build", "--platform", Platform}

	if opts.Tag != "" {
		args = append(args, "--tag", opts.Tag)
	}

	if opts.Target != "" {
		args = append(args, "--target", opts.Target)
	}

	if opts.OutputDir != "" {
		args = append(args, "--output", "type=local,dest="+opts.OutputDir)
	}

	return append(args, opts.ContextDir)
}

// RunArgs returns the docker arguments for a run: always removed and without network.
func RunArgs(opts RunOptions) []string {
	args := []string{"run", "--rm", "--network", "none", "--platform", Platform}

	if opts.CPUSet != "" {
		args = append(args, "--cpuset-cpus", opts.CPUSet)
	}

	for _, m := range opts.Mounts {
		spec := "type=bind,source=" + m.Source + ",target=" + m.Target

		if m.ReadOnly {
			spec += ",readonly"
		}

		args = append(args, "--mount", spec)
	}

	if opts.Entrypoint != "" {
		args = append(args, "--entrypoint", opts.Entrypoint)
	}

	args = append(args, opts.Image)
	return append(args, opts.Args...)
}

// ParseInspect extracts the entrypoint from `docker image inspect` output.
func ParseInspect(data []byte) (ImageInfo, error) {
	var images []struct {
		Config struct {
			Entrypoint []string
		}
	}

	if err := json.Unmarshal(data, &images); err != nil {
		return ImageInfo{}, fmt.Errorf("parse docker image inspect: %w", err)
	}

	if len(images) != 1 {
		return ImageInfo{}, fmt.Errorf("docker image inspect returned %d images", len(images))
	}

	return ImageInfo{Entrypoint: images[0].Config.Entrypoint}, nil
}

func lastLine(text string) string {
	lines := strings.Split(strings.TrimSpace(text), "\n")
	return lines[len(lines)-1]
}
