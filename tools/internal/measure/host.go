package measure

import (
	"bufio"
	"io/fs"
	"strings"
)

// ProcHostProbe reads host information from a /proc filesystem.
type ProcHostProbe struct {
	Root fs.FS // the filesystem root ("/"), so proc/cpuinfo is readable
	Arch string
}

// Probe implements HostProbe. Missing files leave fields empty rather than failing.
func (p ProcHostProbe) Probe() HostInfo {
	info := HostInfo{Arch: p.Arch}

	if data, err := fs.ReadFile(p.Root, "proc/sys/kernel/osrelease"); err == nil {
		info.Kernel = strings.TrimSpace(string(data))
	}

	if data, err := fs.ReadFile(p.Root, "proc/cpuinfo"); err == nil {
		info.CPUModel, info.CPUs = parseCPUInfo(string(data))
	}

	return info
}

// parseCPUInfo returns the first "model name" and the number of "processor" entries.
// The processor count reflects the host, not a container's cpuset.
func parseCPUInfo(cpuinfo string) (string, int) {
	model := ""
	count := 0
	scanner := bufio.NewScanner(strings.NewReader(cpuinfo))

	for scanner.Scan() {
		key, value, found := strings.Cut(scanner.Text(), ":")

		if !found {
			continue
		}

		key = strings.TrimSpace(key)

		if key == "processor" {
			count++
		}

		if key == "model name" && model == "" {
			model = strings.TrimSpace(value)
		}
	}

	return model, count
}
