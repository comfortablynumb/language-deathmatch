package sitegen

import (
	"fmt"
	"io/fs"
	"path"
	"path/filepath"
	"time"

	"deathmatch/tools/internal/catalog"
	"deathmatch/tools/internal/jsonio"
	"deathmatch/tools/internal/textutil"
)

// Clock provides the generation timestamp.
type Clock interface {
	Now() time.Time
}

// SystemClock is the real clock.
type SystemClock struct{}

// Now implements Clock.
func (SystemClock) Now() time.Time { return time.Now() }

// Generator writes catalog.json and one document per project into OutDir.
type Generator struct {
	Source fs.FS // repository root, to read implementation files
	Output jsonio.Writer
	Clock  Clock
	OutDir string
}

// Generate writes every site document for the catalog.
func (g Generator) Generate(c *catalog.Catalog) error {
	doc := CatalogDoc{
		GeneratedAt: g.Clock.Now().UTC().Format(time.RFC3339),
		Languages:   c.Languages,
		Categories:  c.Categories,
		Levels:      c.Levels,
		Projects:    make([]ProjectSummary, 0, len(c.Projects)),
	}

	for _, project := range c.Projects {
		projectDoc, err := g.projectDoc(project)

		if err != nil {
			return err
		}

		if err := g.Output.WriteJSON(filepath.Join(g.OutDir, "projects", project.ID+".json"), projectDoc); err != nil {
			return err
		}

		doc.Projects = append(doc.Projects, summarize(project, projectDoc.Implementations))
	}

	return g.Output.WriteJSON(filepath.Join(g.OutDir, "catalog.json"), doc)
}

func (g Generator) projectDoc(project catalog.Project) (ProjectDoc, error) {
	doc := ProjectDoc{
		ID:              project.ID,
		Name:            project.Name,
		Summary:         project.Summary,
		Category:        project.Category,
		Level:           project.Level,
		Kind:            project.Kind,
		Tags:            nonNil(project.Tags),
		Spec:            project.Spec,
		Verify:          project.Verify,
		Benchmarks:      project.Benchmarks,
		Implementations: make([]ImplementationDoc, 0, len(project.Implementations)),
	}

	for _, impl := range project.Implementations {
		implDoc, err := g.implementation(project.ID, impl)

		if err != nil {
			return ProjectDoc{}, err
		}

		doc.Implementations = append(doc.Implementations, implDoc)
	}

	return doc, nil
}

func (g Generator) implementation(projectID string, impl catalog.Implementation) (ImplementationDoc, error) {
	doc := ImplementationDoc{Language: impl.Language, Notes: nonNil(impl.Notes)}
	dir := catalog.ImplDir(projectID, impl.Language)

	for _, file := range impl.Files {
		data, err := fs.ReadFile(g.Source, path.Join(dir, file.Path))

		if err != nil {
			return ImplementationDoc{}, fmt.Errorf("read %s/%s: %w", dir, file.Path, err)
		}

		content := textutil.NormalizeNewlines(string(data))
		doc.Files = append(doc.Files, FileDoc{
			Path:      file.Path,
			Role:      file.Role,
			Highlight: catalog.HighlightFor(file.Path),
			Lines:     textutil.CountLines(content),
			Content:   content,
		})

		if file.Role == catalog.RoleSource {
			doc.LOC += textutil.CountNonBlankLines(content)
		}
	}

	return doc, nil
}
