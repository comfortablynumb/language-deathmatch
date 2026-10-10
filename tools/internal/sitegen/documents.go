// Package sitegen turns the catalog into the JSON documents consumed by the website.
package sitegen

import "deathmatch/tools/internal/catalog"

// CatalogDoc is site/data/catalog.json.
type CatalogDoc struct {
	GeneratedAt string             `json:"generatedAt"`
	Languages   []catalog.Language `json:"languages"`
	Categories  []catalog.Category `json:"categories"`
	Levels      []catalog.Level    `json:"levels"`
	Projects    []ProjectSummary   `json:"projects"`
}

// ProjectSummary is a project entry of the catalog document. Benchmarks and LOC let the
// website compute fights without loading every project document.
type ProjectSummary struct {
	ID         string         `json:"id"`
	Name       string         `json:"name"`
	Summary    string         `json:"summary"`
	Category   string         `json:"category"`
	Level      int            `json:"level"`
	Kind       string         `json:"kind"`
	Tags       []string       `json:"tags"`
	Languages  []string       `json:"languages"`
	Benchmarks []CaseRef      `json:"benchmarks"`
	LOC        map[string]int `json:"loc"`
}

// CaseRef names a benchmark case of a project.
type CaseRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// ProjectDoc is site/data/projects/<id>.json.
type ProjectDoc struct {
	ID              string                  `json:"id"`
	Name            string                  `json:"name"`
	Summary         string                  `json:"summary"`
	Category        string                  `json:"category"`
	Level           int                     `json:"level"`
	Kind            string                  `json:"kind"`
	Tags            []string                `json:"tags"`
	Spec            catalog.Spec            `json:"spec"`
	Verify          []catalog.VerifyCase    `json:"verify"`
	Benchmarks      []catalog.BenchmarkCase `json:"benchmarks"`
	Implementations []ImplementationDoc     `json:"implementations"`
}

// ImplementationDoc is one implementation with its file contents.
type ImplementationDoc struct {
	Language string    `json:"language"`
	Notes    []string  `json:"notes"`
	LOC      int       `json:"loc"`
	Files    []FileDoc `json:"files"`
}

// FileDoc is one displayed file.
type FileDoc struct {
	Path      string `json:"path"`
	Role      string `json:"role"`
	Highlight string `json:"highlight"`
	Lines     int    `json:"lines"`
	Content   string `json:"content"`
}

// summarize builds the catalog entry of a project from its manifest and its generated
// implementation documents (the source of the lines-of-code counts).
func summarize(project catalog.Project, impls []ImplementationDoc) ProjectSummary {
	languages := make([]string, 0, len(impls))
	loc := make(map[string]int, len(impls))

	for _, impl := range impls {
		languages = append(languages, impl.Language)
		loc[impl.Language] = impl.LOC
	}

	benchmarks := make([]CaseRef, 0, len(project.Benchmarks))

	for _, bc := range project.Benchmarks {
		benchmarks = append(benchmarks, CaseRef{ID: bc.ID, Name: bc.Name})
	}

	return ProjectSummary{
		ID:         project.ID,
		Name:       project.Name,
		Summary:    project.Summary,
		Category:   project.Category,
		Level:      project.Level,
		Kind:       project.Kind,
		Tags:       nonNil(project.Tags),
		Languages:  languages,
		Benchmarks: benchmarks,
		LOC:        loc,
	}
}

func nonNil[T any](values []T) []T {
	if values == nil {
		return []T{}
	}

	return values
}
