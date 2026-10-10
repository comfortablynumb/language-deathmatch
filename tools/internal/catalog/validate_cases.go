package catalog

import (
	"bufio"
	"io/fs"
	"path"
	"strings"
)

func validateVerifyCases(p *problems, scope string, cases []VerifyCase) {
	if len(cases) == 0 {
		p.add(scope, "at least one verification case is required")
	}

	for i, vc := range cases {
		if vc.Name == "" {
			p.add(scope, "verification case %d needs a name", i)
		}

		hasStdout := vc.Stdout != nil
		hasHash := vc.SHA256 != ""

		if hasStdout == hasHash {
			p.add(scope, "verification case %q needs exactly one of stdout or sha256", vc.Name)
		}

		if hasHash && !sha256Pattern.MatchString(vc.SHA256) {
			p.add(scope, "verification case %q has an invalid sha256", vc.Name)
		}
	}
}

func validateBenchmarks(p *problems, scope string, cases []BenchmarkCase) {
	if len(cases) == 0 {
		p.add(scope, "at least one benchmark case is required")
	}

	seen := map[string]bool{}

	for _, bc := range cases {
		checkSlug(p, scope+" benchmark", bc.ID, seen)

		if bc.Name == "" || bc.Runs < 1 || bc.Warmup < 0 {
			p.add(scope, "benchmark %q needs a name, runs >= 1 and warmup >= 0", bc.ID)
		}

		if !sha256Pattern.MatchString(bc.SHA256) {
			p.add(scope, "benchmark %q needs a valid sha256 of its output", bc.ID)
		}
	}
}

// implTarget is an implementation together with its directory.
type implTarget struct {
	dir  string
	impl Implementation
}

func validateImplementation(p *problems, fsys fs.FS, c *Catalog, target implTarget) {
	dir, impl := target.dir, target.impl
	language, ok := c.LanguageByID(impl.Language)

	if !ok {
		p.add(dir, "unknown language %q (folder name must be a language id)", impl.Language)
	}

	hasSource := false

	for _, file := range impl.Files {
		hasSource = hasSource || file.Role == RoleSource
		validateImplFile(p, fsys, dir, file)
	}

	if !hasSource {
		p.add(dir, "at least one file with role %q is required", RoleSource)
	}

	if ok {
		validateDockerfile(p, fsys, dir, language.Image)
	}
}

func validateImplFile(p *problems, fsys fs.FS, dir string, file ImplFile) {
	if file.Role != RoleSource && file.Role != RoleBuild {
		p.add(dir, "file %q has role %q (want %q or %q)", file.Path, file.Role, RoleSource, RoleBuild)
	}

	if _, err := fs.Stat(fsys, path.Join(dir, file.Path)); err != nil {
		p.add(dir, "file %q listed in %s does not exist", file.Path, ImplFileName)
	}
}

// validateDockerfile requires the first FROM instruction to use the language's pinned image.
func validateDockerfile(p *problems, fsys fs.FS, dir, image string) {
	data, err := fs.ReadFile(fsys, path.Join(dir, DockerfileName))

	if err != nil {
		p.add(dir, "missing %s", DockerfileName)
		return
	}

	if got := firstFromImage(string(data)); got != image {
		p.add(dir, "%s must start FROM %q (found %q)", DockerfileName, image, got)
	}
}

// firstFromImage returns the image of the first FROM instruction, skipping flags such
// as --platform.
func firstFromImage(dockerfile string) string {
	scanner := bufio.NewScanner(strings.NewReader(dockerfile))

	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())

		if len(fields) < 2 || !strings.EqualFold(fields[0], "FROM") {
			continue
		}

		for _, field := range fields[1:] {
			if !strings.HasPrefix(field, "--") {
				return field
			}
		}
	}

	return ""
}
