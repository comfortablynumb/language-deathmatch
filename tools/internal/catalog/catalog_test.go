package catalog

import (
	"strings"
	"testing"
	"testing/fstest"
)

const testLanguages = `[
  {"id": "go", "name": "Go", "color": "#00ADD8", "kind": "compiled", "toolchain": "Go", "image": "golang:1", "website": "https://go.dev",
   "fighter": {"glyph": "Go", "nickname": "The Gopher", "special": "Goroutine Barrage", "fatality": "Garbage Collected", "quote": "Ship it."}},
  {"id": "python", "name": "Python", "color": "#3776AB", "kind": "interpreted", "toolchain": "CPython", "image": "python:3", "website": "https://python.org",
   "fighter": {"glyph": "Py", "nickname": "The Serpent", "special": "Comprehension Coil", "fatality": "IndentationError", "quote": "Readable."}}
]`

const testCategories = `[{"id": "algorithms", "name": "Algorithms", "description": "x",
  "arena": {"stage": "The Number Pit", "tagline": "Nowhere to hide.", "color": "#f97316"}}]`

const testProject = `{
  "name": "Demo", "summary": "A demo.", "category": "algorithms", "level": 1, "kind": "cli",
  "tags": ["cpu-bound"],
  "spec": {"description": "d", "input": "i", "output": "o", "rules": ["r"]},
  "verify": [
    {"name": "ok", "args": ["1"], "exitCode": 0, "stdout": "0\n"},
    {"name": "big", "args": ["9"], "exitCode": 0, "sha256": "` + testHash + `"}
  ],
  "benchmarks": [{"id": "small", "name": "Small", "args": ["1"], "warmup": 1, "runs": 3, "sha256": "` + testHash + `"}]
}`

const testHash = "356f8e5349048d902084bc657340d5c36c8f8bfdd82d587fad79c7933f602ad5"

func file(content string) *fstest.MapFile {
	return &fstest.MapFile{Data: []byte(content)}
}

func validFS() fstest.MapFS {
	return fstest.MapFS{
		LanguagesFile:                     file(testLanguages),
		CategoriesFile:                    file(testCategories),
		LevelsFile:                        file(`[{"level": 1, "name": "Trivial", "description": "x"}]`),
		"projects/demo/project.json":      file(testProject),
		"projects/demo/python/impl.json":  file(`{"notes": [], "files": [{"path": "main.py", "role": "source"}]}`),
		"projects/demo/python/main.py":    file("print(0)\n"),
		"projects/demo/python/Dockerfile": file("FROM python:3\n"),
		"projects/demo/go/impl.json":      file(`{"notes": ["n"], "files": [{"path": "main.go", "role": "source"}, {"path": "Dockerfile", "role": "build"}]}`),
		"projects/demo/go/main.go":        file("package main\n"),
		"projects/demo/go/Dockerfile":     file("# build\nFROM --platform=linux/amd64 golang:1 AS build\nFROM scratch\n"),
	}
}

func TestLoadValidCatalog(t *testing.T) {
	c, err := Load(validFS())

	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	if len(c.Projects) != 1 || c.Projects[0].ID != "demo" {
		t.Fatalf("projects = %+v", c.Projects)
	}

	impls := c.Projects[0].Implementations

	if len(impls) != 2 || impls[0].Language != "go" || impls[1].Language != "python" {
		t.Fatalf("implementations not in catalog language order: %+v", impls)
	}

	if c.Projects[0].Verify[0].Stdout == nil || *c.Projects[0].Verify[0].Stdout != "0\n" {
		t.Fatalf("stdout not parsed: %+v", c.Projects[0].Verify[0])
	}
}

func TestLoadReportsAllProblems(t *testing.T) {
	fsys := validFS()
	fsys["projects/demo/go/Dockerfile"] = file("FROM golang:2\n")
	fsys["projects/demo/go/impl.json"] = file(`{"files": [{"path": "missing.go", "role": "source"}]}`)
	fsys["projects/demo/project.json"] = file(strings.Replace(testProject, `"category": "algorithms"`, `"category": "nope"`, 1))

	_, err := Load(fsys)

	if err == nil {
		t.Fatal("Load succeeded, want validation errors")
	}

	for _, want := range []string{"must start FROM", "missing.go", `unknown category "nope"`} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error %q does not mention %q", err, want)
		}
	}
}

func TestLoadRejectsUnknownLanguageFolder(t *testing.T) {
	fsys := validFS()
	fsys["projects/demo/cobol/impl.json"] = file(`{"files": [{"path": "main.cob", "role": "source"}]}`)
	fsys["projects/demo/cobol/main.cob"] = file("x")

	_, err := Load(fsys)

	if err == nil || !strings.Contains(err.Error(), `unknown language "cobol"`) {
		t.Fatalf("err = %v, want unknown language", err)
	}
}

func TestLoadRejectsAmbiguousVerifyCase(t *testing.T) {
	fsys := validFS()
	project := strings.Replace(testProject, `"stdout": "0\n"}`, `"stdout": "0\n", "sha256": "`+testHash+`"}`, 1)
	fsys["projects/demo/project.json"] = file(project)

	_, err := Load(fsys)

	if err == nil || !strings.Contains(err.Error(), "exactly one of stdout or sha256") {
		t.Fatalf("err = %v, want ambiguous verification case error", err)
	}
}

func TestLoadRejectsUnsupportedKind(t *testing.T) {
	fsys := validFS()
	fsys["projects/demo/project.json"] = file(strings.Replace(testProject, `"kind": "cli"`, `"kind": "server"`, 1))

	_, err := Load(fsys)

	if err == nil || !strings.Contains(err.Error(), `kind "server" is not supported`) {
		t.Fatalf("err = %v, want unsupported kind", err)
	}
}

func TestLoadMissingImplManifest(t *testing.T) {
	fsys := validFS()
	fsys["projects/demo/rust/main.rs"] = file("fn main() {}")

	if _, err := Load(fsys); err == nil || !strings.Contains(err.Error(), "impl.json") {
		t.Fatalf("err = %v, want missing impl.json", err)
	}
}

func TestFirstFromImage(t *testing.T) {
	cases := map[string]string{
		"FROM alpine:3 AS build\nFROM scratch": "alpine:3",
		"# c\nfrom --platform=$X node:24\n":    "node:24",
		"RUN echo\n":                           "",
	}

	for input, want := range cases {
		if got := firstFromImage(input); got != want {
			t.Errorf("firstFromImage(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestHighlightFor(t *testing.T) {
	cases := map[string]string{
		"main.go": "go", "src/main.rs": "rust", "fibonacci.asm": "x86asm", "Dockerfile": "dockerfile",
		"Cargo.toml": "ini", "main.py": "python", "main.js": "javascript", "go.mod": "plaintext", "x.zzz": "plaintext",
	}

	for input, want := range cases {
		if got := HighlightFor(input); got != want {
			t.Errorf("HighlightFor(%q) = %q, want %q", input, got, want)
		}
	}
}
