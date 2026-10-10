package cli

import (
	"context"
	"io"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"deathmatch/tools/internal/docker"
	"deathmatch/tools/internal/jsonio"
)

type fixedClock struct{}

func (fixedClock) Now() time.Time { return time.Date(2026, 10, 8, 0, 0, 0, 0, time.UTC) }

const hash = "356f8e5349048d902084bc657340d5c36c8f8bfdd82d587fad79c7933f602ad5"

func repo() fstest.MapFS {
	file := func(s string) *fstest.MapFile { return &fstest.MapFile{Data: []byte(s)} }

	return fstest.MapFS{
		"catalog/languages.json": file(`[{"id": "go", "name": "Go", "color": "#00ADD8", "kind": "compiled", "toolchain": "Go", "image": "golang:1",
			"fighter": {"glyph": "Go", "nickname": "The Gopher", "special": "s", "fatality": "f", "quote": "q"}}]`),
		"catalog/categories.json": file(`[{"id": "algorithms", "name": "Algorithms",
			"arena": {"stage": "The Number Pit", "tagline": "t", "color": "#f97316"}}]`),
		"catalog/levels.json": file(`[{"level": 1, "name": "Trivial"}]`),
		"projects/demo/project.json": file(`{"name": "Demo", "summary": "s", "category": "algorithms", "level": 1, "kind": "cli",
			"verify": [{"name": "ten", "args": ["10"], "exitCode": 0, "sha256": "` + hash + `"}],
			"benchmarks": [{"id": "small", "name": "Small", "args": ["10"], "warmup": 0, "runs": 1, "sha256": "` + hash + `"}]}`),
		"projects/demo/go/impl.json":  file(`{"files": [{"path": "main.go", "role": "source"}]}`),
		"projects/demo/go/main.go":    file("package main\n"),
		"projects/demo/go/Dockerfile": file("FROM golang:1\n"),
	}
}

type failingDocker struct{}

func (failingDocker) Build(context.Context, docker.BuildOptions) error { return nil }
func (failingDocker) Inspect(context.Context, string) (docker.ImageInfo, error) {
	return docker.ImageInfo{Entrypoint: []string{"/app/x"}}, nil
}
func (failingDocker) Run(context.Context, docker.RunOptions) (docker.RunResult, error) {
	return docker.RunResult{ExitCode: 1}, nil
}
func (failingDocker) ServerVersion(context.Context) (string, error) { return "", nil }

type meta struct{}

func (meta) Commit(context.Context) string { return "" }
func (meta) Runner() string                { return "local" }

func TestRunCatalogWritesDocuments(t *testing.T) {
	out := &jsonio.MemoryWriter{}
	deps := CatalogDeps{Source: repo(), Output: out, Clock: fixedClock{}, Log: io.Discard}

	if err := RunCatalog(CatalogConfig{OutDir: "data"}, deps); err != nil {
		t.Fatalf("RunCatalog: %v", err)
	}

	for _, name := range []string{"data/catalog.json", "data/projects/demo.json"} {
		if _, ok := out.Files[name]; !ok {
			t.Errorf("%s not written; got %v", name, out.Files)
		}
	}
}

func TestRunBenchFailsWhenVerificationFails(t *testing.T) {
	out := &jsonio.MemoryWriter{}
	deps := BenchDeps{Source: repo(), Output: out, Docker: failingDocker{}, Meta: meta{}, Clock: fixedClock{}, Log: io.Discard}
	err := RunBench(context.Background(), BenchConfig{Out: "results.json", HarnessDir: "/h"}, deps)

	if err == nil || !strings.Contains(err.Error(), "1 of 1 implementations failed") {
		t.Fatalf("err = %v", err)
	}

	if _, ok := out.Files["results.json"]; !ok {
		t.Fatal("results should be written even when implementations fail")
	}
}

func TestRunBenchVerifyOnlyWritesNothing(t *testing.T) {
	out := &jsonio.MemoryWriter{}
	deps := BenchDeps{Source: repo(), Output: out, Docker: failingDocker{}, Meta: meta{}, Clock: fixedClock{}, Log: io.Discard}
	_ = RunBench(context.Background(), BenchConfig{Out: "results.json", VerifyOnly: true}, deps)

	if len(out.Files) != 0 {
		t.Fatalf("verify-only wrote %v", out.Files)
	}
}

func TestParseBenchConfig(t *testing.T) {
	cfg, err := ParseBenchConfig([]string{"-lang", "go, rust", "-verify-only", "-harness", "h"}, io.Discard)

	if err != nil || !cfg.VerifyOnly || !slices.Equal(cfg.Languages, []string{"go", "rust"}) || cfg.Projects != nil {
		t.Fatalf("ParseBenchConfig = %+v, %v", cfg, err)
	}

	if !filepath.IsAbs(cfg.HarnessDir) || !filepath.IsAbs(cfg.Root) {
		t.Fatalf("paths must be absolute: %+v", cfg)
	}

	if _, err := ParseBenchConfig([]string{"-nope"}, io.Discard); err == nil {
		t.Fatal("unknown flag accepted")
	}
}

func TestParseCatalogConfig(t *testing.T) {
	cfg, err := ParseCatalogConfig([]string{"-out", "x"}, io.Discard)

	if err != nil || cfg.OutDir != "x" || !filepath.IsAbs(cfg.Root) {
		t.Fatalf("ParseCatalogConfig = %+v, %v", cfg, err)
	}
}

func TestSplitList(t *testing.T) {
	if got := SplitList(" a, ,b ,"); !slices.Equal(got, []string{"a", "b"}) {
		t.Fatalf("SplitList = %v", got)
	}

	if got := SplitList(""); got != nil {
		t.Fatalf("SplitList(\"\") = %v", got)
	}
}
