package stats

import (
	"math"
	"testing"
)

func almostEqual(a, b float64) bool {
	return math.Abs(a-b) < 1e-9
}

func TestSummarizeEmpty(t *testing.T) {
	if got := Summarize(nil); got != (Summary{}) {
		t.Fatalf("Summarize(nil) = %+v, want zero", got)
	}
}

func TestSummarizeOddCount(t *testing.T) {
	got := Summarize([]float64{5, 1, 3})

	want := Summary{Min: 1, Q1: 2, Median: 3, Q3: 4, Max: 5, Mean: 3, Stddev: 2}

	if got != want {
		t.Fatalf("Summarize = %+v, want %+v", got, want)
	}
}

func TestSummarizeDoesNotMutateInput(t *testing.T) {
	values := []float64{3, 2, 1}
	Summarize(values)

	if values[0] != 3 || values[2] != 1 {
		t.Fatalf("input was reordered: %v", values)
	}
}

func TestQuantileInterpolates(t *testing.T) {
	sorted := []float64{10, 20, 30, 40}

	cases := map[float64]float64{0: 10, 0.25: 17.5, 0.5: 25, 0.75: 32.5, 1: 40}

	for q, want := range cases {
		if got := Quantile(sorted, q); !almostEqual(got, want) {
			t.Errorf("Quantile(%v) = %v, want %v", q, got, want)
		}
	}
}

func TestStddevSingleValue(t *testing.T) {
	if got := Stddev([]float64{42}, 42); got != 0 {
		t.Fatalf("Stddev of one value = %v, want 0", got)
	}
}

func TestSummarizeInts(t *testing.T) {
	got := SummarizeInts([]int64{2, 4, 4, 4, 5, 5, 7, 9})

	if !almostEqual(got.Mean, 5) || !almostEqual(got.Median, 4.5) {
		t.Fatalf("SummarizeInts = %+v", got)
	}

	if !almostEqual(got.Stddev, math.Sqrt(32.0/7.0)) {
		t.Fatalf("Stddev = %v", got.Stddev)
	}
}
