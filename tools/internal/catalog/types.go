// Package catalog loads and validates the Language Deathmatch manifests: languages,
// categories, levels, projects and their implementations.
package catalog

// Language is an entry of catalog/languages.json.
type Language struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Color     string  `json:"color"`
	Kind      string  `json:"kind"`
	Toolchain string  `json:"toolchain"`
	Image     string  `json:"image"`
	Website   string  `json:"website"`
	Fighter   Fighter `json:"fighter"`
}

// Fighter is the deathmatch profile of a language.
type Fighter struct {
	Glyph    string `json:"glyph"`    // 1-4 characters shown as the fighter's emblem
	Nickname string `json:"nickname"` // e.g. "The Crab"
	Special  string `json:"special"`  // move name of blows won by 5x or more
	Fatality string `json:"fatality"` // move name of the finishing blow of a fatality
	Quote    string `json:"quote"`    // victory quote
}

// Category is an entry of catalog/categories.json.
type Category struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Arena       Arena  `json:"arena"`
}

// Arena is the deathmatch profile of a category.
type Arena struct {
	Stage   string `json:"stage"`   // e.g. "The Number Pit"
	Tagline string `json:"tagline"` // one line of flavor text
	Color   string `json:"color"`   // #RRGGBB glow of the fight stage
}

// Level is an entry of catalog/levels.json.
type Level struct {
	Level       int    `json:"level"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// Spec is the human-readable specification of a project.
type Spec struct {
	Description string   `json:"description"`
	Input       string   `json:"input"`
	Output      string   `json:"output"`
	Rules       []string `json:"rules"`
}

// VerifyCase checks an implementation's exit code and stdout for given arguments.
// Exactly one of Stdout (exact text) or SHA256 (hex digest of stdout) is set.
type VerifyCase struct {
	Name     string   `json:"name"`
	Args     []string `json:"args"`
	ExitCode int      `json:"exitCode"`
	Stdout   *string  `json:"stdout,omitempty"`
	SHA256   string   `json:"sha256,omitempty"`
}

// BenchmarkCase is one timed scenario of a project.
type BenchmarkCase struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Args        []string `json:"args"`
	Warmup      int      `json:"warmup"`
	Runs        int      `json:"runs"`
	SHA256      string   `json:"sha256"`
}

// ImplFile is a file of an implementation shown on the website.
type ImplFile struct {
	Path string `json:"path"`
	Role string `json:"role"`
}

// Implementation is one language's version of a project (projects/<id>/<lang>/impl.json).
type Implementation struct {
	Language string     `json:"-"`
	Notes    []string   `json:"notes"`
	Files    []ImplFile `json:"files"`
}

// Project is a projects/<id>/project.json manifest plus its implementations.
type Project struct {
	ID              string           `json:"-"`
	Name            string           `json:"name"`
	Summary         string           `json:"summary"`
	Category        string           `json:"category"`
	Level           int              `json:"level"`
	Kind            string           `json:"kind"`
	Tags            []string         `json:"tags"`
	Spec            Spec             `json:"spec"`
	Verify          []VerifyCase     `json:"verify"`
	Benchmarks      []BenchmarkCase  `json:"benchmarks"`
	Implementations []Implementation `json:"-"`
}

// Catalog is the whole set of manifests.
type Catalog struct {
	Languages  []Language
	Categories []Category
	Levels     []Level
	Projects   []Project
}

// Role values for ImplFile.
const (
	RoleSource = "source"
	RoleBuild  = "build"
)

// KindCLI is the only project kind supported by the benchmark runner today.
const KindCLI = "cli"

// LanguageByID returns the language with the given id.
func (c *Catalog) LanguageByID(id string) (Language, bool) {
	for _, language := range c.Languages {
		if language.ID == id {
			return language, true
		}
	}

	return Language{}, false
}

// ProjectByID returns the project with the given id.
func (c *Catalog) ProjectByID(id string) (Project, bool) {
	for _, project := range c.Projects {
		if project.ID == id {
			return project, true
		}
	}

	return Project{}, false
}
