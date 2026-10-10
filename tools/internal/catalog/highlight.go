package catalog

import (
	"path"
	"strings"
)

// highlightByName maps exact file names to highlight.js language ids.
var highlightByName = map[string]string{
	"dockerfile": "dockerfile",
	"makefile":   "makefile",
	"go.mod":     "plaintext",
	"cargo.lock": "ini",
}

// highlightByExt maps file extensions to highlight.js language ids.
var highlightByExt = map[string]string{
	".go":   "go",
	".rs":   "rust",
	".c":    "c",
	".h":    "cpp",
	".cc":   "cpp",
	".cpp":  "cpp",
	".hpp":  "cpp",
	".asm":  "x86asm",
	".s":    "x86asm",
	".py":   "python",
	".java": "java",
	".hs":   "haskell",
	// highlight.js has no Zig or V grammar; Rust's keywords (fn, pub, const, mut, struct,
	// match, return), strings, comments and numbers cover theirs closely.
	".zig":  "rust",
	".v":    "rust",
	".js":   "javascript",
	".mjs":  "javascript",
	".cjs":  "javascript",
	".ts":   "typescript",
	".json": "json",
	".toml": "ini",
	".yml":  "yaml",
	".yaml": "yaml",
	".sh":   "bash",
	".md":   "markdown",
}

// HighlightFor returns the highlight.js language id for a file path ("plaintext" if unknown).
func HighlightFor(filePath string) string {
	name := strings.ToLower(path.Base(filePath))

	if language, ok := highlightByName[name]; ok {
		return language
	}

	if language, ok := highlightByExt[path.Ext(name)]; ok {
		return language
	}

	return "plaintext"
}
