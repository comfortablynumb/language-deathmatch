package jsonio

import (
	"path/filepath"
	"testing"
)

func TestEncodeKeepsHTMLCharacters(t *testing.T) {
	data, err := Encode(map[string]string{"code": "a < b && c > d"})

	if err != nil || string(data) != "{\"code\":\"a < b && c > d\"}\n" {
		t.Fatalf("Encode = %s, %v", data, err)
	}
}

func TestMemoryWriterNormalizesPaths(t *testing.T) {
	w := &MemoryWriter{}

	if err := w.WriteJSON(filepath.Join("a", "b.json"), 1); err != nil {
		t.Fatalf("WriteJSON: %v", err)
	}

	if string(w.Files["a/b.json"]) != "1\n" {
		t.Fatalf("files = %v", w.Files)
	}
}
