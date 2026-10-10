package sitegen

import (
	"encoding/json"
	"testing"
	"testing/fstest"
	"time"

	"deathmatch/tools/internal/catalog"
	"deathmatch/tools/internal/jsonio"
)

type fixedClock struct{}

func (fixedClock) Now() time.Time { return time.Date(2026, 10, 8, 12, 0, 0, 0, time.UTC) }

func testCatalog() *catalog.Catalog {
	return &catalog.Catalog{
		Languages: []catalog.Language{{ID: "go", Name: "Go"}},
		Projects: []catalog.Project{{
			ID: "demo", Name: "Demo", Summary: "s", Category: "algorithms", Level: 1, Kind: "cli",
			Benchmarks: []catalog.BenchmarkCase{{ID: "small", Name: "Small"}, {ID: "large", Name: "Large"}},
			Implementations: []catalog.Implementation{{
				Language: "go",
				Files: []catalog.ImplFile{
					{Path: "main.go", Role: catalog.RoleSource},
					{Path: "Dockerfile", Role: catalog.RoleBuild},
				},
			}},
		}},
	}
}

func testSource() fstest.MapFS {
	return fstest.MapFS{
		"projects/demo/go/main.go":    {Data: []byte("package main\r\n\r\nfunc main() {}\r\n")},
		"projects/demo/go/Dockerfile": {Data: []byte("FROM golang\nRUN x\n")},
	}
}

func TestGenerateWritesCatalogAndProjects(t *testing.T) {
	out := &jsonio.MemoryWriter{}
	g := Generator{Source: testSource(), Output: out, Clock: fixedClock{}, OutDir: "site/data"}

	if err := g.Generate(testCatalog()); err != nil {
		t.Fatalf("Generate: %v", err)
	}

	var doc CatalogDoc

	if err := json.Unmarshal(out.Files["site/data/catalog.json"], &doc); err != nil {
		t.Fatalf("catalog.json: %v", err)
	}

	if doc.GeneratedAt != "2026-10-08T12:00:00Z" || len(doc.Projects) != 1 {
		t.Fatalf("catalog doc = %+v", doc)
	}

	if got := doc.Projects[0].Languages; len(got) != 1 || got[0] != "go" {
		t.Fatalf("project languages = %v", got)
	}
}

func TestGenerateProjectDocument(t *testing.T) {
	out := &jsonio.MemoryWriter{}
	g := Generator{Source: testSource(), Output: out, Clock: fixedClock{}, OutDir: "out"}

	if err := g.Generate(testCatalog()); err != nil {
		t.Fatalf("Generate: %v", err)
	}

	var doc ProjectDoc

	if err := json.Unmarshal(out.Files["out/projects/demo.json"], &doc); err != nil {
		t.Fatalf("project doc: %v", err)
	}

	impl := doc.Implementations[0]

	if impl.LOC != 2 {
		t.Errorf("LOC = %d, want 2 (non-blank source lines only)", impl.LOC)
	}

	source := impl.Files[0]

	if source.Content != "package main\n\nfunc main() {}\n" || source.Lines != 3 || source.Highlight != "go" {
		t.Errorf("source file doc = %+v", source)
	}

	if impl.Files[1].Highlight != "dockerfile" || doc.Tags == nil {
		t.Errorf("build file doc = %+v, tags = %v", impl.Files[1], doc.Tags)
	}
}

func TestCatalogSummaryCarriesCasesAndLOC(t *testing.T) {
	out := &jsonio.MemoryWriter{}
	g := Generator{Source: testSource(), Output: out, Clock: fixedClock{}, OutDir: "out"}

	if err := g.Generate(testCatalog()); err != nil {
		t.Fatalf("Generate: %v", err)
	}

	var doc CatalogDoc
	var project ProjectDoc

	if err := json.Unmarshal(out.Files["out/catalog.json"], &doc); err != nil {
		t.Fatalf("catalog.json: %v", err)
	}

	if err := json.Unmarshal(out.Files["out/projects/demo.json"], &project); err != nil {
		t.Fatalf("project doc: %v", err)
	}

	summary := doc.Projects[0]
	want := []CaseRef{{ID: "small", Name: "Small"}, {ID: "large", Name: "Large"}}

	if len(summary.Benchmarks) != 2 || summary.Benchmarks[0] != want[0] || summary.Benchmarks[1] != want[1] {
		t.Errorf("benchmarks = %+v, want %+v", summary.Benchmarks, want)
	}

	if summary.LOC["go"] != project.Implementations[0].LOC || summary.LOC["go"] != 2 {
		t.Errorf("loc = %v, project doc loc = %d", summary.LOC, project.Implementations[0].LOC)
	}
}

func TestGenerateFailsOnMissingFile(t *testing.T) {
	source := testSource()
	delete(source, "projects/demo/go/main.go")
	g := Generator{Source: source, Output: &jsonio.MemoryWriter{}, Clock: fixedClock{}, OutDir: "out"}

	if err := g.Generate(testCatalog()); err == nil {
		t.Fatal("Generate succeeded with a missing file")
	}
}
