package printer

import (
	"context"
	"fmt"
	"net"
	"strconv"
	"strings"
	"time"
)

type Info struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	IsDefault    bool     `json:"isDefault"`
	ContentTypes []string `json:"contentTypes"`
	MediaSizes   []string `json:"mediaSizes"`
}

// Print submits printerID/contentType/payload/copies as before, plus
// mediaSize — the PDF's own intended page size (e.g. "a4"), so platform
// implementations can tell the OS print driver to fit/scale the page onto
// whatever paper is actually loaded instead of printing at fixed "actual
// size" and risking the driver clipping content that falls outside the
// physical printer's guaranteed imageable area. Only meaningful for
// contentType=="pdf" (page-format Invoice jobs); raw/escpos/zpl/tspl jobs
// ignore it. See docs/print-module/PRINT_DELIVERY_AND_AGENT_COMPLETION_PLAN.md.
type System interface {
	List(context.Context) ([]Info, error)
	Print(ctx context.Context, printerID, contentType string, payload []byte, copies int, mediaSize string) error
}

func NewSystem() System { return newPlatformSystem() }

func defaultCapabilities() []string {
	return []string{"80mm", "58mm", "A4", "Letter"}
}

func defaultContentTypes() []string {
	return []string{"pdf", "escpos", "zpl", "tspl", "raw"}
}

func PrintTCP(ctx context.Context, address string, payload []byte) error {
	host, portText, err := net.SplitHostPort(address)
	if err != nil {
		if strings.Count(address, ":") == 0 {
			host, portText = address, "9100"
		} else {
			return fmt.Errorf("invalid printer address: %w", err)
		}
	}
	port, err := strconv.Atoi(portText)
	if err != nil || port < 1 || port > 65535 {
		return fmt.Errorf("invalid printer port")
	}
	if !allowedHost(host) {
		return fmt.Errorf("printer host must be loopback or private network")
	}
	dialer := net.Dialer{Timeout: 8 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(host, strconv.Itoa(port)))
	if err != nil {
		return err
	}
	defer conn.Close()
	_ = conn.SetWriteDeadline(time.Now().Add(20 * time.Second))
	_, err = conn.Write(payload)
	return err
}

func allowedHost(host string) bool {
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && (ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast())
}
