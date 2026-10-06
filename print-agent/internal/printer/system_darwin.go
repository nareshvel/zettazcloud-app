//go:build darwin

package printer

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type darwinSystem struct{}

func newPlatformSystem() System { return &darwinSystem{} }

func createDarwinSpoolFile() (*os.File, error) {
	cacheDir, err := os.UserCacheDir()
	if err != nil {
		return nil, err
	}
	spoolDir := filepath.Join(cacheDir, "Zettaz", "PrintAgent", "spool")
	if err = os.MkdirAll(spoolDir, 0o700); err != nil {
		return nil, err
	}
	return os.CreateTemp(spoolDir, "zettaz-print-*")
}

func (s *darwinSystem) List(ctx context.Context) ([]Info, error) {
	output, err := exec.CommandContext(ctx, "lpstat", "-p", "-d").CombinedOutput()
	if err != nil && len(output) == 0 {
		return nil, fmt.Errorf("lpstat: %w", err)
	}
	defaultName := ""
	var printers []Info
	for _, line := range strings.Split(string(output), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "system default destination:") {
			defaultName = strings.TrimSpace(strings.TrimPrefix(line, "system default destination:"))
		}
		if strings.HasPrefix(line, "printer ") {
			name := strings.Fields(line)[1]
			printers = append(printers, Info{ID: name, Name: name, ContentTypes: defaultContentTypes(), MediaSizes: defaultCapabilities()})
		}
	}
	for i := range printers {
		printers[i].IsDefault = printers[i].Name == defaultName
	}
	return printers, nil
}

func (s *darwinSystem) Print(ctx context.Context, printerID, contentType string, payload []byte, copies int, mediaSize string) error {
	if contentType != "pdf" && contentType != "escpos" && contentType != "zpl" && contentType != "tspl" && contentType != "raw" {
		return fmt.Errorf("unsupported content type %q", contentType)
	}
	file, err := createDarwinSpoolFile()
	if err != nil {
		return err
	}
	name := file.Name()
	defer os.Remove(name)
	if _, err = file.Write(payload); err != nil {
		_ = file.Close()
		return err
	}
	if err = file.Close(); err != nil {
		return err
	}
	args := []string{}
	if printerID != "" {
		args = append(args, "-d", printerID)
	}
	if copies > 1 {
		args = append(args, "-n", fmt.Sprint(copies))
	}
	if contentType != "pdf" {
		args = append(args, "-o", "raw")
	} else {
		// Every PDF job — page-format Invoice (mediaSize "a4") AND a thermal
		// printer driven as a plain OS printer queue via the Local Agent
		// (mediaSize e.g. "80mm") — is rendered client-side to an exact,
		// correctly-sized PDF (see htmlToPdfBase64 in printerService.ts).
		// Without an explicit fit hint, CUPS prints at "actual size" anchored
		// to the queue's own default media box; if that default doesn't
		// exactly match the PDF's page size (most commonly A4 vs. US Letter,
		// but also possible for a mis-provisioned thermal queue), whatever
		// falls outside the printer's guaranteed imageable area is silently
		// clipped instead of scaled to fit. `fit-to-page` is safe even when
		// sizes already match — it's a no-op in that case.
		args = append(args, "-o", "fit-to-page")
		if strings.EqualFold(mediaSize, "a4") {
			args = append(args, "-o", "media=a4")
		}
	}
	args = append(args, name)
	if output, err := exec.CommandContext(ctx, "lp", args...).CombinedOutput(); err != nil {
		return fmt.Errorf("lp: %s: %w", strings.TrimSpace(string(output)), err)
	}
	return nil
}
