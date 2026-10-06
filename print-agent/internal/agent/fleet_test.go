package agent

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/zettaz/print-agent/internal/printer"
)

func TestFleetEnrollPersistsAndRedactsToken(t *testing.T) {
	t.Setenv("ZETTAZ_AGENT_DEV", "1")
	var enroll CloudEnrollRequest
	heartbeatToken := make(chan string, 1)
	cloud := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/print-agent-connect/enroll" && r.Method == http.MethodPost {
			_ = json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&enroll)
			_, _ = w.Write([]byte(`{"status":"success","data":{"agent_id":"agent-abc","token":"secret-device-token"}}`))
			return
		}
		if r.URL.Path == "/api/print-agent-connect/heartbeat" {
			select {
			case heartbeatToken <- r.Header.Get("Authorization"):
			default:
			}
			w.WriteHeader(http.StatusOK)
			return
		}
		if r.URL.Path == "/api/print-agent-connect/configuration" {
			_, _ = w.Write([]byte(`{"status":"success","data":{"heartbeat_interval":30}}`))
			return
		}
		http.NotFound(w, r)
	}))
	defer cloud.Close()

	dir := t.TempDir()
	server := New(Config{
		Token:          "local-token",
		AllowedOrigins: []string{"http://localhost:5173"},
		ConfigPath:     filepath.Join(dir, "config.json"),
		JobStorePath:   filepath.Join(dir, "jobs.json"),
	})
	server.printers = &fakePrinter{list: []printer.Info{{ID: "fake", Name: "Fake", ContentTypes: []string{"pdf"}, MediaSizes: []string{"A4"}}}}

	body, _ := json.Marshal(map[string]string{"cloudBaseURL": cloud.URL, "code": "123456", "displayName": "Test Agent"})
	req := httptest.NewRequest(http.MethodPost, "/v1/fleet/enroll", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer local-token")
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", res.Code, res.Body.String())
	}
	if enroll.AgentID == "" {
		t.Fatal("enrollment did not send agentId")
	}
	if enroll.DisplayName != "Test Agent" {
		t.Fatalf("unexpected displayName: %s", enroll.DisplayName)
	}

	baseURL, agentID, displayName, deviceToken, _, ok := server.configStore.FleetEnrolled()
	if !ok || agentID != "agent-abc" || deviceToken != "secret-device-token" || baseURL != cloud.URL {
		t.Fatalf("fleet enrollment not persisted correctly: %s %s %s %v", agentID, displayName, deviceToken, ok)
	}

	// Status must not expose the device token.
	req2 := httptest.NewRequest(http.MethodGet, "/v1/fleet/status", nil)
	req2.Header.Set("Authorization", "Bearer local-token")
	res2 := httptest.NewRecorder()
	server.Handler().ServeHTTP(res2, req2)
	if res2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res2.Code, res2.Body.String())
	}
	if strings.Contains(res2.Body.String(), "secret-device-token") {
		t.Fatal("status endpoint leaked device token")
	}

	// Wait briefly for at least one heartbeat.
	var token string
	select {
	case token = <-heartbeatToken:
	case <-time.After(time.Second):
	}
	if !strings.HasPrefix(token, "Bearer ") {
		t.Fatalf("expected bearer token in heartbeat, got %q", token)
	}
	_ = server.Shutdown()
}

func TestFleetRevocation(t *testing.T) {
	t.Setenv("ZETTAZ_AGENT_DEV", "1")
	cloud := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/print-agent-connect/enroll" {
			_, _ = w.Write([]byte(`{"status":"success","data":{"agent_id":"agent-abc","token":"secret"}}`))
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer cloud.Close()

	dir := t.TempDir()
	server := New(Config{
		Token:          "local-token",
		AllowedOrigins: []string{"http://localhost:5173"},
		ConfigPath:     filepath.Join(dir, "config.json"),
		JobStorePath:   filepath.Join(dir, "jobs.json"),
	})
	server.printers = &fakePrinter{}

	body, _ := json.Marshal(map[string]string{"cloudBaseURL": cloud.URL, "code": "1"})
	req := httptest.NewRequest(http.MethodPost, "/v1/fleet/enroll", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer local-token")
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("enroll failed: %d %s", res.Code, res.Body.String())
	}

	req2 := httptest.NewRequest(http.MethodDelete, "/v1/fleet/enrollment", nil)
	req2.Header.Set("Authorization", "Bearer local-token")
	res2 := httptest.NewRecorder()
	server.Handler().ServeHTTP(res2, req2)
	if res2.Code != http.StatusOK {
		t.Fatalf("revoke failed: %d %s", res2.Code, res2.Body.String())
	}
	if _, _, _, _, _, ok := server.configStore.FleetEnrolled(); ok {
		t.Fatal("fleet enrollment still present after revocation")
	}
	if server.getCloudClient() != nil {
		t.Fatal("cloud client not cleared after revocation")
	}
}

func TestBackwardConfigCompatibility(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.json")
	old := []byte(`{"tokenHash":"abc","clientId":"browser","allowedOrigins":["http://localhost:5173"],"pairingCode":"123456"}`)
	if err := os.WriteFile(path, old, 0o600); err != nil {
		t.Fatal(err)
	}
	store, err := NewConfigStore(path, nil)
	if err != nil {
		t.Fatal(err)
	}
	if !store.IsPaired() || store.PairingCode() != "123456" {
		t.Fatal("existing config not preserved")
	}
	id := store.AgentID()
	if id == "" {
		t.Fatal("agent id not generated")
	}
	// Reload and ensure the original fields and new fleet block coexist.
	store2, err := NewConfigStore(path, nil)
	if err != nil {
		t.Fatal(err)
	}
	if store2.AgentID() != id {
		t.Fatalf("agent id not stable: %s vs %s", store2.AgentID(), id)
	}
	if store2.data.ClientID != "browser" {
		t.Fatalf("client id not preserved: %s", store2.data.ClientID)
	}
}

func TestBuildHeartbeatAllowlist(t *testing.T) {
	dir := t.TempDir()
	server := New(Config{
		Token:          "local-token",
		AllowedOrigins: []string{"http://localhost:5173"},
		ConfigPath:     filepath.Join(dir, "config.json"),
		JobStorePath:   filepath.Join(dir, "jobs.json"),
	})
	server.printers = &fakePrinter{list: []printer.Info{{ID: "fake-id", Name: "Fake", ContentTypes: []string{"pdf"}, MediaSizes: []string{"A4"}}}}
	_ = server.configStore.SetFleetEnrollment("https://cloud.example.com", "agent-1", "Name", "dev-token", "stable")

	req := server.buildHeartbeat()
	raw, _ := json.Marshal(req)
	body := string(raw)
	for _, forbidden := range []string{"dev-token", "payload", "Bearer", "/Users/", "/home/"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("heartbeat contains forbidden token %q: %s", forbidden, body)
		}
	}
	if req.Version != Version || req.Platform != "darwin" && req.Platform != "linux" && req.Platform != "windows" {
		t.Fatalf("unexpected runtime fields: %+v", req)
	}
	if req.Printers.Total != 1 {
		t.Fatalf("unexpected printer total: %d", req.Printers.Total)
	}
}

func TestCloudURLRejectsInvalid(t *testing.T) {
	for _, input := range []string{"", "ftp://cloud.zettaz.com", "://bad"} {
		if err := ValidateCloudURL(input); err == nil {
			t.Fatalf("expected rejection for %q", input)
		}
	}
}
