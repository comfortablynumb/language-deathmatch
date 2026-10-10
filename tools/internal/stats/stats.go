// Package stats computes descriptive statistics for benchmark samples.
package stats

import (
	"math"
	"slices"
)

// Summary describes a sample distribution (box plot + mean/stddev).
type Summary struct {
	Min    float64 `json:"min"`
	Q1     float64 `json:"q1"`
	Median float64 `json:"median"`
	Q3     float64 `json:"q3"`
	Max    float64 `json:"max"`
	Mean   float64 `json:"mean"`
	Stddev float64 `json:"stddev"`
}

// Summarize returns the summary of values; an empty input yields a zero Summary.
func Summarize(values []float64) Summary {
	if len(values) == 0 {
		return Summary{}
	}

	sorted := slices.Clone(values)
	slices.Sort(sorted)
	mean := Mean(sorted)

	return Summary{
		Min:    sorted[0],
		Q1:     Quantile(sorted, 0.25),
		Median: Quantile(sorted, 0.5),
		Q3:     Quantile(sorted, 0.75),
		Max:    sorted[len(sorted)-1],
		Mean:   mean,
		Stddev: Stddev(sorted, mean),
	}
}

// SummarizeInts converts integer samples and summarizes them.
func SummarizeInts(values []int64) Summary {
	floats := make([]float64, len(values))

	for i, v := range values {
		floats[i] = float64(v)
	}

	return Summarize(floats)
}

// Quantile returns the q-quantile (0..1) of sorted values using linear interpolation
// between closest ranks (the "type 7" definition used by R and NumPy).
func Quantile(sorted []float64, q float64) float64 {
	if len(sorted) == 0 {
		return 0
	}

	position := q * float64(len(sorted)-1)
	lower := int(math.Floor(position))
	upper := int(math.Ceil(position))
	fraction := position - float64(lower)

	return sorted[lower] + (sorted[upper]-sorted[lower])*fraction
}

// Mean returns the arithmetic mean, or 0 for an empty input.
func Mean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}

	sum := 0.0

	for _, v := range values {
		sum += v
	}

	return sum / float64(len(values))
}

// Stddev returns the sample standard deviation (n-1), or 0 with fewer than two values.
func Stddev(values []float64, mean float64) float64 {
	if len(values) < 2 {
		return 0
	}

	squares := 0.0

	for _, v := range values {
		squares += (v - mean) * (v - mean)
	}

	return math.Sqrt(squares / float64(len(values)-1))
}
