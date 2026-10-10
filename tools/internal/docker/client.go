// Package docker wraps the docker CLI behind an interface.
package docker

import "context"

// Platform is the platform every image is built and run for (Assembly targets x86-64).
const Platform = "linux/amd64"

// BuildOptions describes a docker build. With OutputDir set, the target stage's files are
// exported to that host directory instead of producing a tagged image.
type BuildOptions struct {
	ContextDir string
	Tag        string
	Target     string
	OutputDir  string
}

// Mount is a read-only or read-write bind mount.
type Mount struct {
	Source   string
	Target   string
	ReadOnly bool
}

// RunOptions describes a `docker run --rm --network none` invocation.
type RunOptions struct {
	Image      string
	Args       []string
	Entrypoint string
	Mounts     []Mount
	CPUSet     string
}

// RunResult holds the container's exit code and captured output.
type RunResult struct {
	ExitCode int
	Stdout   []byte
	Stderr   []byte
}

// ImageInfo describes a built image: its ENTRYPOINT and uncompressed size.
type ImageInfo struct {
	Entrypoint []string
	SizeBytes  int64
}

// Client is the Docker functionality used by the benchmark runner.
type Client interface {
	Build(ctx context.Context, opts BuildOptions) error
	Inspect(ctx context.Context, image string) (ImageInfo, error)
	Run(ctx context.Context, opts RunOptions) (RunResult, error)
	ServerVersion(ctx context.Context) (string, error)
}
