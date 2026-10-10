package catalog

import (
	"errors"
	"fmt"
	"io/fs"
	"path"
	"regexp"
	"slices"
	"strings"
)

var (
	slugPattern   = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)
	colorPattern  = regexp.MustCompile(`^#[0-9A-Fa-f]{6}$`)
	sha256Pattern = regexp.MustCompile(`^[0-9a-f]{64}$`)
	languageKinds = []string{"compiled", "interpreted", "jit", "assembled"}
)

// problems collects validation messages so every issue is reported at once.
type problems struct {
	list []string
}

func (p *problems) add(scope, format string, args ...any) {
	p.list = append(p.list, scope+": "+fmt.Sprintf(format, args...))
}

func (p *problems) err() error {
	if len(p.list) == 0 {
		return nil
	}

	return errors.New("invalid catalog:\n  - " + strings.Join(p.list, "\n  - "))
}

// Validate checks the catalog for consistency; fsys is used to check referenced files.
func Validate(fsys fs.FS, c *Catalog) error {
	p := &problems{}
	validateLanguages(p, c.Languages)
	validateCategories(p, c.Categories)
	validateLevels(p, c.Levels)

	for _, project := range c.Projects {
		validateProject(p, fsys, c, project)
	}

	return p.err()
}

func validateLanguages(p *problems, languages []Language) {
	seen := map[string]bool{}

	for _, l := range languages {
		scope := LanguagesFile + " " + l.ID
		checkSlug(p, scope, l.ID, seen)

		if l.Name == "" || l.Toolchain == "" || l.Image == "" {
			p.add(scope, "name, toolchain and image are required")
		}

		if !colorPattern.MatchString(l.Color) {
			p.add(scope, "color %q must look like #RRGGBB", l.Color)
		}

		if !slices.Contains(languageKinds, l.Kind) {
			p.add(scope, "kind %q must be one of %v", l.Kind, languageKinds)
		}

		validateFighter(p, scope, l.Fighter)
	}
}

func validateCategories(p *problems, categories []Category) {
	seen := map[string]bool{}

	for _, category := range categories {
		scope := CategoriesFile + " " + category.ID
		checkSlug(p, scope, category.ID, seen)

		if category.Name == "" {
			p.add(scope, "name is required")
		}

		validateArena(p, scope, category.Arena)
	}
}

func validateLevels(p *problems, levels []Level) {
	for i, level := range levels {
		if level.Level != i+1 || level.Name == "" {
			p.add(LevelsFile, "entry %d must have level %d and a name", i, i+1)
		}
	}
}

func checkSlug(p *problems, scope, id string, seen map[string]bool) {
	if !slugPattern.MatchString(id) {
		p.add(scope, "id %q must be lowercase kebab-case", id)
	}

	if seen[id] {
		p.add(scope, "duplicate id %q", id)
	}

	seen[id] = true
}

func validateProject(p *problems, fsys fs.FS, c *Catalog, project Project) {
	scope := path.Join(ProjectsDir, project.ID)
	checkSlug(p, scope, project.ID, map[string]bool{})
	validateProjectFields(p, scope, c, project)
	validateVerifyCases(p, scope, project.Verify)
	validateBenchmarks(p, scope, project.Benchmarks)

	if len(project.Implementations) == 0 {
		p.add(scope, "at least one implementation is required")
	}

	for _, impl := range project.Implementations {
		validateImplementation(p, fsys, c, implTarget{dir: ImplDir(project.ID, impl.Language), impl: impl})
	}
}

func validateProjectFields(p *problems, scope string, c *Catalog, project Project) {
	if project.Name == "" || project.Summary == "" {
		p.add(scope, "name and summary are required")
	}

	if !slices.ContainsFunc(c.Categories, func(cat Category) bool { return cat.ID == project.Category }) {
		p.add(scope, "unknown category %q", project.Category)
	}

	if project.Level < 1 || project.Level > len(c.Levels) {
		p.add(scope, "level %d must be between 1 and %d", project.Level, len(c.Levels))
	}

	if project.Kind != KindCLI {
		p.add(scope, "kind %q is not supported yet (supported: %q)", project.Kind, KindCLI)
	}

	for _, tag := range project.Tags {
		if !slugPattern.MatchString(tag) {
			p.add(scope, "tag %q must be lowercase kebab-case", tag)
		}
	}
}
