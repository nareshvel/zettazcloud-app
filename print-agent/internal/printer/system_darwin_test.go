//go:build darwin

package printer

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCreateDarwinSpoolFileIgnoresInvalidTMPDIR(t *testing.T) {
	cacheDir := t.TempDir()
	t.Setenv("HOME", t.TempDir())
	t.Setenv("TMPDIR", filepath.Join(t.TempDir(), "deleted-installer-sandbox"))
	t.Setenv("XDG_CACHE_HOME", cacheDir)

	file, err := createDarwinSpoolFile()
	if err != nil {
		t.Fatal(err)
	}
	name := file.Name()
	if err = file.Close(); err != nil {
		t.Fatal(err)
	}
	defer os.Remove(name)

	if strings.Contains(name, "deleted-installer-sandbox") {
		t.Fatalf("spool file used TMPDIR: %s", name)
	}
	if _, err = os.Stat(name); err != nil {
		t.Fatalf("spool file is not readable: %v", err)
	}
}
