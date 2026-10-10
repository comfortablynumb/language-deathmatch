package textutil

import "testing"

func TestNormalizeNewlines(t *testing.T) {
	if got := NormalizeNewlines("a\r\nb\rc\n"); got != "a\nb\nc\n" {
		t.Fatalf("NormalizeNewlines = %q", got)
	}
}

func TestCountLines(t *testing.T) {
	cases := map[string]int{"": 0, "a": 1, "a\n": 1, "a\nb": 2, "a\n\nb\n": 3}

	for input, want := range cases {
		if got := CountLines(input); got != want {
			t.Errorf("CountLines(%q) = %d, want %d", input, got, want)
		}
	}
}

func TestCountNonBlankLines(t *testing.T) {
	cases := map[string]int{"": 0, "a\n\n  \nb\n": 2, "\t\n": 0, "x": 1}

	for input, want := range cases {
		if got := CountNonBlankLines(input); got != want {
			t.Errorf("CountNonBlankLines(%q) = %d, want %d", input, got, want)
		}
	}
}

func TestTruncate(t *testing.T) {
	if got := Truncate("hello", 10); got != "hello" {
		t.Errorf("Truncate short = %q", got)
	}

	if got := Truncate("hello world", 5); got != "hello…" {
		t.Errorf("Truncate long = %q", got)
	}
}
