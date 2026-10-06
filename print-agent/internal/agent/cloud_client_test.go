package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func TestValidateCloudURLRequiresHTTPS(t *testing.T) {
	if err := ValidateCloudURL("https://cloud.zettaz.com"); err != nil {
		t.Fatalf("expected https cloud URL to be valid: %v", err)
	}
	if err := ValidateCloudURL("http://cloud.zettaz.com"); err == nil {
		t.Fatal("expected http cloud URL to be rejected outside development")
	}
}

func TestValidateCloudURLAllowsHTTPLoopbackInDev(t *testing.T) {
	t.Setenv("ZETTAZ_AGENT_DEV", "1")
	for _, url := range []string{"http://localhost:8080", "http://127.0.0.1:8080"} {
		if err := ValidateCloudURL(url); err != nil {
			t.Fatalf("expected %s to be valid in dev: %v", url, err)
		}
	}
	if err := ValidateCloudURL("http://cloud.zettaz.com"); err == nil {
		t.Fatal("expected non-loopback http URL to be rejected even in dev")
	}
}

func TestCloudClientEnrollSucceeds(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/print-agent-connect/enroll" || r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}
		var req CloudEnrollRequest
		_ = json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req)
		if req.Code != "123456" {
			http.Error(w, "bad code", http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(`{"status":"success","data":{"agent_id":"agent-abc","token":"token-xyz"}}`))
	}))
	defer server.Close()

	client := NewCloudClient(server.URL, "")
	resp, err := client.Enroll(context.Background(), CloudEnrollRequest{Code: "123456"})
	if err != nil {
		t.Fatalf("enroll failed: %v", err)
	}
	if resp.AgentID != "agent-abc" || resp.DeviceToken != "token-xyz" {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestCloudClientBoundedResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"agentId":"`))
		for i := 0; i < 1<<21; i++ {
			w.Write([]byte("x"))
		}
	}))
	defer server.Close()

	client := NewCloudClient(server.URL, "")
	_, err := client.Enroll(context.Background(), CloudEnrollRequest{Code: "x"})
	if err == nil {
		t.Fatalf("expected error from huge response, got: %v", err)
	}
}

func TestCloudClientHeartbeatAndConfiguration(t *testing.T) {
	var heartbeat []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/print-agent-connect/heartbeat":
			heartbeat, _ = io.ReadAll(io.LimitReader(r.Body, 1<<20))
			w.WriteHeader(http.StatusOK)
		case "/api/print-agent-connect/configuration":
			_, _ = w.Write([]byte(`{"status":"success","data":{"heartbeat_interval":30,"update_channel":"stable"}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := NewCloudClient(server.URL, "secret-token")
	req := HeartbeatRequest{Version: Version, Platform: "linux", Architecture: "arm64", OSVersion: RuntimeOSVersion()}
	if err := client.Heartbeat(context.Background(), req); err != nil {
		t.Fatalf("heartbeat failed: %v", err)
	}
	var sent HeartbeatRequest
	if err := json.Unmarshal(heartbeat, &sent); err != nil {
		t.Fatal(err)
	}
	if sent.Platform != "linux" || sent.Version != Version {
		t.Fatalf("unexpected heartbeat payload: %+v", sent)
	}
	body := string(heartbeat)
	if strings.Contains(body, "secret-token") || strings.Contains(body, "payload") {
		t.Fatal("heartbeat leaked sensitive data")
	}

	cfg, err := client.GetConfiguration(context.Background())
	if err != nil {
		t.Fatalf("configuration fetch failed: %v", err)
	}
	if cfg.HeartbeatIntervalSeconds != 30 || cfg.UpdateChannel != "stable" {
		t.Fatalf("unexpected configuration: %+v", cfg)
	}
}

func TestCloudClientTimeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(50 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := newCloudClientWithHTTP(server.URL, "token", &http.Client{Timeout: 10 * time.Millisecond})
	err := client.Heartbeat(context.Background(), HeartbeatRequest{})
	if err == nil {
		t.Fatal("expected timeout error")
	}
}

func TestRedactBearer(t *testing.T) {
	cases := []struct{ in, want string }{
		{"error with Bearer abc123 token", "error with Bearer [redacted] token"},
		{"no token here", "no token here"},
		{"Bearer abc and Bearer def", "Bearer [redacted] and Bearer [redacted]"},
	}
	for _, c := range cases {
		if got := redactBearer(c.in); got != c.want {
			t.Fatalf("redactBearer(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestSanitizeErrorRedactsHomeAndToken(t *testing.T) {
	t.Setenv("HOME", "/Users/testagent")
	home, _ := os.UserHomeDir()
	input := fmt.Sprintf("failed to write to %s/printer.log: Bearer abc123", home)
	out := sanitizeError(input)
	if strings.Contains(out, home) || strings.Contains(out, "abc123") {
		t.Fatalf("sanitized error still contains sensitive data: %s", out)
	}
	if out == "" {
		t.Fatal("sanitized error is empty")
	}
}
