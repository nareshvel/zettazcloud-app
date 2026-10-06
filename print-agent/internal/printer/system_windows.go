//go:build windows

package printer

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"syscall"
	"unsafe"
)

var (
	winspool     = syscall.NewLazyDLL("winspool.drv")
	openPrinter  = winspool.NewProc("OpenPrinterW")
	closePrinter = winspool.NewProc("ClosePrinter")
	startDoc     = winspool.NewProc("StartDocPrinterW")
	endDoc       = winspool.NewProc("EndDocPrinter")
	startPage    = winspool.NewProc("StartPagePrinter")
	endPage      = winspool.NewProc("EndPagePrinter")
	writePrinter = winspool.NewProc("WritePrinter")
)

type windowsSystem struct{}
type docInfo struct{ Name, Output, DataType *uint16 }

func newPlatformSystem() System { return &windowsSystem{} }

func (s *windowsSystem) List(ctx context.Context) ([]Info, error) {
	script := `Get-Printer | Select-Object Name,Default | ConvertTo-Json -Compress`
	output, err := exec.CommandContext(ctx, "powershell", "-NoProfile", "-Command", script).CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("Get-Printer: %s: %w", strings.TrimSpace(string(output)), err)
	}
	var rows []struct {
		Name    string
		Default bool
	}
	if len(output) == 0 {
		return rowsToInfo(rows), nil
	}
	if output[0] == '{' {
		var row struct {
			Name    string
			Default bool
		}
		if err := json.Unmarshal(output, &row); err != nil {
			return nil, err
		}
		rows = append(rows, row)
	} else if err := json.Unmarshal(output, &rows); err != nil {
		return nil, err
	}
	return rowsToInfo(rows), nil
}

func rowsToInfo(rows []struct {
	Name    string
	Default bool
}) []Info {
	out := make([]Info, 0, len(rows))
	for _, row := range rows {
		out = append(out, Info{ID: row.Name, Name: row.Name, IsDefault: row.Default, ContentTypes: defaultContentTypes(), MediaSizes: defaultCapabilities()})
	}
	return out
}

func (s *windowsSystem) Print(ctx context.Context, printerID, contentType string, payload []byte, copies int, mediaSize string) error {
	_ = ctx
	if contentType == "pdf" {
		file, err := os.CreateTemp("", "zettaz-print-*.pdf")
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
		sumatra := os.Getenv("ZETTAZ_AGENT_SUMATRA")
		if sumatra == "" {
			sumatra, err = exec.LookPath("SumatraPDF.exe")
		}
		if err != nil || sumatra == "" {
			return fmt.Errorf("SumatraPDF.exe is required for silent Windows PDF printing")
		}
		args := []string{"-silent", "-exit-on-print", "-print-to", printerID}
		// -print-settings takes a single comma-separated list, so the copies
		// multiplier and the fit setting must be combined into one flag, not
		// two separate ones (a second -print-settings would just overwrite
		// the first). "fit" tells SumatraPDF to scale the PDF page to the
		// printer's paper size instead of printing at fixed "actual size" —
		// without it, a PDF sent to a printer/driver whose default paper
		// size doesn't exactly match the PDF's own page size (commonly A4
		// vs. US Letter for Invoice jobs, but also possible for a
		// mis-provisioned thermal queue) prints unscaled and can be clipped
		// by the printer's hardware margin. Applied to every PDF job, not
		// just A4 ones — it's a no-op when sizes already match. See the
		// matching CUPS fit-to-page fix in system_darwin.go/system_linux.go.
		_ = mediaSize
		settings := "fit"
		if copies > 1 {
			settings = fmt.Sprintf("%dx,fit", copies)
		}
		args = append(args, "-print-settings", settings)
		args = append(args, name)
		output, err := exec.CommandContext(ctx, sumatra, args...).CombinedOutput()
		if err != nil {
			return fmt.Errorf("SumatraPDF: %s: %w", strings.TrimSpace(string(output)), err)
		}
		return nil
	}
	for i := 0; i < max(1, copies); i++ {
		if err := printRawWindows(printerID, payload); err != nil {
			return err
		}
	}
	return nil
}

func printRawWindows(name string, data []byte) error {
	if name == "" {
		return fmt.Errorf("printer id is required")
	}
	printerName, _ := syscall.UTF16PtrFromString(name)
	var handle syscall.Handle
	if ok, _, callErr := openPrinter.Call(uintptr(unsafe.Pointer(printerName)), uintptr(unsafe.Pointer(&handle)), 0); ok == 0 {
		return fmt.Errorf("OpenPrinter: %v", callErr)
	}
	defer closePrinter.Call(uintptr(handle))
	docName, _ := syscall.UTF16PtrFromString("Zettaz Print Job")
	dataType, _ := syscall.UTF16PtrFromString("RAW")
	info := docInfo{Name: docName, DataType: dataType}
	if ok, _, callErr := startDoc.Call(uintptr(handle), 1, uintptr(unsafe.Pointer(&info))); ok == 0 {
		return fmt.Errorf("StartDocPrinter: %v", callErr)
	}
	defer endDoc.Call(uintptr(handle))
	if ok, _, callErr := startPage.Call(uintptr(handle)); ok == 0 {
		return fmt.Errorf("StartPagePrinter: %v", callErr)
	}
	defer endPage.Call(uintptr(handle))
	var written uint32
	if ok, _, callErr := writePrinter.Call(uintptr(handle), uintptr(unsafe.Pointer(&data[0])), uintptr(len(data)), uintptr(unsafe.Pointer(&written))); ok == 0 {
		return fmt.Errorf("WritePrinter: %v", callErr)
	}
	if int(written) != len(data) {
		return fmt.Errorf("incomplete printer write %d/%d", written, len(data))
	}
	return nil
}
