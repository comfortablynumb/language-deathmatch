// Package bench orchestrates builds, verification and measurements of every
// implementation and produces site/data/results.json.
package bench

import (
	"deathmatch/tools/internal/measure"
	"deathmatch/tools/internal/stats"
)

// Status values.
const (
	StatusOK     = "ok"
	StatusFailed = "failed"
)

// Results is site/data/results.json.
type Results struct {
	GeneratedAt string       `json:"generatedAt"`
	Commit      string       `json:"commit"`
	Environment Environment  `json:"environment"`
	Results     []ImplResult `json:"results"`
}

// Environment describes where the benchmarks ran.
type Environment struct {
	CPUModel string `json:"cpuModel"`
	CPUs     int    `json:"cpus"`
	Kernel   string `json:"kernel"`
	Arch     string `json:"arch"`
	Docker   string `json:"docker"`
	Runner   string `json:"runner"`
}

// ImplResult is the outcome for one implementation.
type ImplResult struct {
	Project      string       `json:"project"`
	Language     string       `json:"language"`
	Status       string       `json:"status"`
	Error        string       `json:"error"`
	Image        ImageRef     `json:"image"`
	Verification []CaseCheck  `json:"verification"`
	Benchmarks   []CaseResult `json:"benchmarks"`
}

// ImageRef identifies the built image.
type ImageRef struct {
	Tag       string `json:"tag"`
	SizeBytes int64  `json:"sizeBytes"`
}

// CaseCheck is the outcome of one verification case.
type CaseCheck struct {
	Name    string `json:"name"`
	Passed  bool   `json:"passed"`
	Message string `json:"message"`
}

// CaseResult is the outcome of one benchmark case.
type CaseResult struct {
	Case    string       `json:"case"`
	Status  string       `json:"status"`
	Error   string       `json:"error"`
	Samples SampleSeries `json:"samples"`
	Stats   CaseStats    `json:"stats"`

	host measure.HostInfo
}

// SampleSeries holds the raw samples per metric, in run order.
type SampleSeries struct {
	WallNs   []int64 `json:"wallNs"`
	CPUNs    []int64 `json:"cpuNs"`
	MaxRssKb []int64 `json:"maxRssKb"`
}

// CaseStats summarizes each metric.
type CaseStats struct {
	WallNs   stats.Summary `json:"wallNs"`
	CPUNs    stats.Summary `json:"cpuNs"`
	MaxRssKb stats.Summary `json:"maxRssKb"`
}

// FailedCount returns how many implementations failed.
func (r Results) FailedCount() int {
	count := 0

	for _, result := range r.Results {
		if result.Status == StatusFailed {
			count++
		}
	}

	return count
}

func (r *ImplResult) fail(message string) ImplResult {
	r.Status = StatusFailed
	r.Error = message
	return *r
}

// caseFromReport converts a harness report into a benchmark case result. Times come
// from the timed runs, peak memory from the (traced, exact) memory runs.
func caseFromReport(caseID string, report measure.Report) CaseResult {
	series := SampleSeries{MaxRssKb: report.MemoryKb}

	for _, sample := range report.Samples {
		series.WallNs = append(series.WallNs, sample.WallNs)
		series.CPUNs = append(series.CPUNs, sample.UserNs+sample.SysNs)
	}

	return CaseResult{
		Case:    caseID,
		Status:  StatusOK,
		Samples: series,
		Stats: CaseStats{
			WallNs:   stats.SummarizeInts(series.WallNs),
			CPUNs:    stats.SummarizeInts(series.CPUNs),
			MaxRssKb: stats.SummarizeInts(series.MaxRssKb),
		},
		host: report.Host,
	}
}

func failedCase(caseID, message string) CaseResult {
	return CaseResult{Case: caseID, Status: StatusFailed, Error: message}
}
