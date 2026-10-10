// Package textutil holds small text helpers shared by the tools.
package textutil

import "strings"

// NormalizeNewlines converts CRLF and lone CR line endings to LF.
func NormalizeNewlines(content string) string {
	content = strings.ReplaceAll(content, "\r\n", "\n")
	return strings.ReplaceAll(content, "\r", "\n")
}

// CountLines returns the number of lines; a final line without '\n' still counts.
func CountLines(content string) int {
	if content == "" {
		return 0
	}

	lines := strings.Count(content, "\n")

	if !strings.HasSuffix(content, "\n") {
		lines++
	}

	return lines
}

// CountNonBlankLines returns the number of lines containing non-whitespace characters.
func CountNonBlankLines(content string) int {
	count := 0

	for line := range strings.SplitSeq(content, "\n") {
		if strings.TrimSpace(line) != "" {
			count++
		}
	}

	return count
}

// Truncate shortens s to at most max bytes, appending "…" when it was cut.
func Truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}

	return s[:max] + "…"
}
