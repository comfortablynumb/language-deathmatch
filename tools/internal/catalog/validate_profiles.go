package catalog

import (
	"strings"
	"unicode"
	"unicode/utf8"
)

// maxGlyph is the longest fighter glyph, in characters ("ASM", "C++").
const maxGlyph = 4

// validateFighter checks the deathmatch profile of a language.
func validateFighter(p *problems, scope string, f Fighter) {
	length := utf8.RuneCountInString(f.Glyph)

	if length < 1 || length > maxGlyph || strings.ContainsFunc(f.Glyph, unicode.IsSpace) {
		p.add(scope, "fighter.glyph %q must be 1-%d characters without spaces", f.Glyph, maxGlyph)
	}

	if f.Nickname == "" || f.Special == "" || f.Fatality == "" || f.Quote == "" {
		p.add(scope, "fighter.nickname, fighter.special, fighter.fatality and fighter.quote are required")
	}
}

// validateArena checks the deathmatch profile of a category.
func validateArena(p *problems, scope string, a Arena) {
	if a.Stage == "" || a.Tagline == "" {
		p.add(scope, "arena.stage and arena.tagline are required")
	}

	if !colorPattern.MatchString(a.Color) {
		p.add(scope, "arena.color %q must look like #RRGGBB", a.Color)
	}
}
