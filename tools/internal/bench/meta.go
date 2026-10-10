package bench

import (
	"bytes"
	"context"
	"io"
	"os"
	"strings"

	"deathmatch/tools/internal/execx"
)

// MetaProvider describes the run: source commit and runner type.
type MetaProvider interface {
	Commit(ctx context.Context) string
	Runner() string
}

// Env reads environment variables.
type Env interface {
	Getenv(key string) string
}

// OSEnv reads the process environment.
type OSEnv struct{}

// Getenv implements Env.
func (OSEnv) Getenv(key string) string { return os.Getenv(key) }

// EnvMeta resolves metadata from GitHub Actions variables, falling back to git.
type EnvMeta struct {
	Env  Env
	Git  execx.Runner
	Root string
}

const shortCommit = 7

// Commit implements MetaProvider: GITHUB_SHA, else `git rev-parse HEAD`, else "".
func (m EnvMeta) Commit(ctx context.Context) string {
	if sha := m.Env.Getenv("GITHUB_SHA"); sha != "" {
		return shorten(sha)
	}

	var out bytes.Buffer
	cmd := execx.Command{Name: "git", Args: []string{"-C", m.Root, "rev-parse", "HEAD"}, Stdout: &out, Stderr: io.Discard}
	code, err := m.Git.Run(ctx, cmd)

	if err != nil || code != 0 {
		return ""
	}

	return shorten(strings.TrimSpace(out.String()))
}

// Runner implements MetaProvider.
func (m EnvMeta) Runner() string {
	if m.Env.Getenv("GITHUB_ACTIONS") == "true" {
		return "github-actions"
	}

	return "local"
}

func shorten(sha string) string {
	if len(sha) > shortCommit {
		return sha[:shortCommit]
	}

	return sha
}
