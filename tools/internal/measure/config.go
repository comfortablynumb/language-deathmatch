package measure

import (
	"errors"
	"flag"
	"io"
	"time"
)

// ParseConfig parses ldmmeasure flags: [flags] -- command [args...].
func ParseConfig(args []string, output io.Writer) (Config, error) {
	flags := flag.NewFlagSet("ldmmeasure", flag.ContinueOnError)
	flags.SetOutput(output)

	cfg := Config{}
	flags.IntVar(&cfg.Runs, "runs", 10, "number of timed runs")
	flags.IntVar(&cfg.Warmup, "warmup", 1, "number of untimed warmup runs")
	flags.IntVar(&cfg.MemoryRuns, "memory-runs", 3, "number of traced (untimed) peak-memory runs")
	flags.DurationVar(&cfg.Timeout, "timeout", 2*time.Minute, "timeout of each run")
	flags.StringVar(&cfg.SHA256, "sha256", "", "expected sha256 of the program's stdout")
	flags.StringVar(&cfg.Launcher, "launcher", "/ldm/ldmexec", "path of the ldmexec launcher")

	if err := flags.Parse(args); err != nil {
		return Config{}, err
	}

	cfg.Command = flags.Args()

	if len(cfg.Command) == 0 {
		return Config{}, errors.New("missing command: ldmmeasure [flags] -- command [args...]")
	}

	if cfg.Runs < 1 || cfg.Warmup < 0 || cfg.MemoryRuns < 1 || cfg.Timeout <= 0 {
		return Config{}, errors.New("runs and memory-runs must be >= 1, warmup >= 0 and timeout > 0")
	}

	return cfg, nil
}
