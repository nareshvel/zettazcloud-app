//go:build linux

package printer

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

type linuxSystem struct{}

func newPlatformSystem() System { return &linuxSystem{} }

func (s *linuxSystem) List(ctx context.Context) ([]Info, error) {
	output, err := exec.CommandContext(ctx, "lpstat", "-p", "-d").CombinedOutput()
	if err != nil && len(output) == 0 {
		return nil, err
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

func (s *linuxSystem) Print(ctx context.Context, printerID, contentType string, payload []byte, copies int, mediaSize string) error {
	file, err := os.CreateTemp("", "zettaz-print-*")
	if err != nil {
		return err
	}
	name := file.Name()
	defer os.Remove(name)
	if _, err = file.Write(payload); err != nil {
		_ = file.Close()
		return err
	}
	_ = file.Close()
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
		// See the matching comment in system_darwin.go's Print(): every PDF
		// job (page-format Invoice or a thermal printer driven as a plain OS
		// queue via the Local Agent) gets an explicit fit hint so CUPS scales
		// to the printer's imageable area instead of clipping at "actual
		// size" when the queue's default media doesn't match the PDF exactly.
		args = append(args, "-o", "fit-to-page")
		if strings.EqualFold(mediaSize, "a4") {
			args = append(args, "-o", "media=a4")
		}
	}
	args = append(args, name)
	output, err := exec.CommandContext(ctx, "lp", args...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("lp: %s: %w", strings.TrimSpace(string(output)), err)
	}
	return nil
}
