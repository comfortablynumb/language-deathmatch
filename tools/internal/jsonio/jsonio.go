// Package jsonio writes JSON documents behind an interface so callers can be tested
// without touching the filesystem.
package jsonio

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Writer persists a value as JSON at path.
type Writer interface {
	WriteJSON(path string, value any) error
}

// Encode marshals value without HTML escaping (code samples contain <, > and &).
func Encode(value any) ([]byte, error) {
	var buf bytes.Buffer
	encoder := json.NewEncoder(&buf)
	encoder.SetEscapeHTML(false)

	if err := encoder.Encode(value); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

// FileWriter writes JSON files to the local filesystem, creating parent directories.
type FileWriter struct{}

// WriteJSON implements Writer.
func (FileWriter) WriteJSON(path string, value any) error {
	data, err := Encode(value)

	if err != nil {
		return fmt.Errorf("encode %s: %w", path, err)
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create directory for %s: %w", path, err)
	}

	return os.WriteFile(path, data, 0o644)
}

// MemoryWriter keeps written documents in memory; used by tests.
type MemoryWriter struct {
	Files map[string][]byte
}

// WriteJSON implements Writer.
func (m *MemoryWriter) WriteJSON(path string, value any) error {
	data, err := Encode(value)

	if err != nil {
		return err
	}

	if m.Files == nil {
		m.Files = map[string][]byte{}
	}

	m.Files[filepath.ToSlash(path)] = data
	return nil
}
