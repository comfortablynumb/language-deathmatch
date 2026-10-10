package catalog

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"path"
	"slices"
)

// Paths of the manifests, relative to the repository root.
const (
	LanguagesFile  = "catalog/languages.json"
	CategoriesFile = "catalog/categories.json"
	LevelsFile     = "catalog/levels.json"
	ProjectsDir    = "projects"
	ProjectFile    = "project.json"
	ImplFileName   = "impl.json"
	DockerfileName = "Dockerfile"
)

// Load reads every manifest from fsys (rooted at the repository root) and validates it.
func Load(fsys fs.FS) (*Catalog, error) {
	c := &Catalog{}

	if err := readJSON(fsys, LanguagesFile, &c.Languages); err != nil {
		return nil, err
	}

	if err := readJSON(fsys, CategoriesFile, &c.Categories); err != nil {
		return nil, err
	}

	if err := readJSON(fsys, LevelsFile, &c.Levels); err != nil {
		return nil, err
	}

	projects, err := loadProjects(fsys, c.Languages)

	if err != nil {
		return nil, err
	}

	c.Projects = projects

	if err := Validate(fsys, c); err != nil {
		return nil, err
	}

	return c, nil
}

// ImplDir returns the directory of an implementation, relative to the repository root.
func ImplDir(projectID, languageID string) string {
	return path.Join(ProjectsDir, projectID, languageID)
}

func readJSON(fsys fs.FS, name string, target any) error {
	data, err := fs.ReadFile(fsys, name)

	if err != nil {
		return fmt.Errorf("read %s: %w", name, err)
	}

	if err := json.Unmarshal(data, target); err != nil {
		return fmt.Errorf("parse %s: %w", name, err)
	}

	return nil
}

func loadProjects(fsys fs.FS, languages []Language) ([]Project, error) {
	entries, err := fs.ReadDir(fsys, ProjectsDir)

	if err != nil {
		return nil, fmt.Errorf("read %s: %w", ProjectsDir, err)
	}

	var projects []Project

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		project, err := loadProject(fsys, entry.Name(), languages)

		if err != nil {
			return nil, err
		}

		projects = append(projects, project)
	}

	return projects, nil
}

func loadProject(fsys fs.FS, id string, languages []Language) (Project, error) {
	var project Project

	if err := readJSON(fsys, path.Join(ProjectsDir, id, ProjectFile), &project); err != nil {
		return Project{}, err
	}

	project.ID = id
	impls, err := loadImplementations(fsys, id)

	if err != nil {
		return Project{}, err
	}

	sortByLanguageOrder(impls, languages)
	project.Implementations = impls
	return project, nil
}

func loadImplementations(fsys fs.FS, projectID string) ([]Implementation, error) {
	entries, err := fs.ReadDir(fsys, path.Join(ProjectsDir, projectID))

	if err != nil {
		return nil, fmt.Errorf("read project %s: %w", projectID, err)
	}

	var impls []Implementation

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		var impl Implementation

		if err := readJSON(fsys, path.Join(ImplDir(projectID, entry.Name()), ImplFileName), &impl); err != nil {
			return nil, err
		}

		impl.Language = entry.Name()
		impls = append(impls, impl)
	}

	return impls, nil
}

// sortByLanguageOrder orders implementations like catalog/languages.json; unknown
// languages go last (validation reports them).
func sortByLanguageOrder(impls []Implementation, languages []Language) {
	rank := func(id string) int {
		index := slices.IndexFunc(languages, func(l Language) bool { return l.ID == id })

		if index < 0 {
			return len(languages)
		}

		return index
	}

	slices.SortStableFunc(impls, func(a, b Implementation) int {
		return rank(a.Language) - rank(b.Language)
	})
}
