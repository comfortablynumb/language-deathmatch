// Package execx abstracts running external commands so they can be faked in tests.
package execx

import (
	"context"
	"errors"
	"io"
	"os/exec"
)

// Command describes an external command invocation.
type Command struct {
	Name   string
	Args   []string
	Stdout io.Writer
	Stderr io.Writer
}

// Runner executes commands and reports their exit code. A non-zero exit code is not an
// error; err is only set when the command could not be started or waited for.
type Runner interface {
	Run(ctx context.Context, cmd Command) (int, error)
}

// OSRunner runs commands with os/exec.
type OSRunner struct{}

// Run implements Runner.
func (OSRunner) Run(ctx context.Context, cmd Command) (int, error) {
	c := exec.CommandContext(ctx, cmd.Name, cmd.Args...)
	c.Stdout = cmd.Stdout
	c.Stderr = cmd.Stderr
	err := c.Run()

	var exitErr *exec.ExitError

	if errors.As(err, &exitErr) {
		return exitErr.ExitCode(), nil
	}

	if err != nil {
		return -1, err
	}

	return 0, nil
}
