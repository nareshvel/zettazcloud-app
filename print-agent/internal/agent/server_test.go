package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/zettaz/print-agent/internal/printer"
)

type fakePrinter struct{ list []printer.Info }

func (f *fakePrinter) List(ctx context.Context) ([]printer.Info, error) { return f.list, nil }
func (f *fakePrinter) Print(ctx context.Context, id, contentType string, payload []byte, copies int, mediaSize string) error {
	for _, p := range f.list {
		if p.ID == id {
			return nil
		}
	}
	return errors.New("printer not found")
}

func newTestServer(t *testing.T) *Server {
	t.Helper()
	dir := t.TempDir()
	server := New(Config{Token: "secret", AllowedOrigins: []string{"http://localhost:5173"}, ConfigPath: filepath.Join(dir, "config.json"), JobStorePath: filepath.Join(dir, "jobs.json")})
	server.printers = &fakePrinter{list: []printer.Info{{ID: "fake-id", Name: "Fake"}}}
	return server
}

func TestHealth(t *testing.T) {
	server := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/v1/health", nil)
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["agent"] != "zettaz-print-agent" {
		t.Fatalf("unexpected body: %v", body)
	}
}

func TestPrintersRequiresToken(t *testing.T) {
	server := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/v1/printers", nil)
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", res.Code)
	}
}

func TestRejectsUnknownOrigin(t *testing.T) {
	server := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/v1/printers", nil)
	req.Header.Set("Origin", "https://malicious.example")
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", res.Code)
	}
}

func TestHealthOpenButHidesPairingCodeFromUnknownOrigin(t *testing.T) {
	server := newTestServer(t)
	// /v1/health stays reachable from any origin — a page must be able to
	// discover the agent before it can pair — but the pairing code (the
	// secret that grants access) is only returned to trusted origins.
	req := httptest.NewRequest(http.MethodGet, "/v1/health", nil)
	req.Header.Set("Origin", "https://malicious.example")
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200 for health discovery, got %d", res.Code)
	}
	if strings.Contains(res.Body.String(), "pairingCode") {
		t.Fatal("pairingCode must not be exposed to an untrusted origin")
	}

	req2 := httptest.NewRequest(http.MethodGet, "/v1/health", nil)
	req2.Header.Set("Origin", "http://localhost:5173")
	res2 := httptest.NewRecorder()
	server.Handler().ServeHTTP(res2, req2)
	if !strings.Contains(res2.Body.String(), "pairingCode") {
		t.Fatal("trusted origin should receive pairingCode")
	}
}

func TestPairingPersistsHashedToken(t *testing.T) {
	dir := t.TempDir()
	server := New(Config{
		AllowedOrigins: []string{"http://localhost:5173"},
		ConfigPath:     filepath.Join(dir, "config.json"),
		JobStorePath:   filepath.Join(dir, "jobs.json"),
	})
	code := server.configStore.PairingCode()
	body, _ := json.Marshal(map[string]string{"pairingCode": code, "clientId": "zettaz-cloud", "origin": "http://localhost:5173"})
	req := httptest.NewRequest(http.MethodPost, "/v1/pair", bytes.NewReader(body))
	req.Header.Set("Origin", "http://localhost:5173")
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", res.Code, res.Body.String())
	}
	var response map[string]any
	_ = json.Unmarshal(res.Body.Bytes(), &response)
	token, _ := response["token"].(string)
	if token == "" {
		t.Fatal("pairing did not return token")
	}
	if !server.configStore.Verify(token) {
		t.Fatal("returned token was not persisted")
	}
}

func TestPairingIsMultiClient(t *testing.T) {
	dir := t.TempDir()
	server := New(Config{
		AllowedOrigins: []string{"http://localhost:5173"},
		ConfigPath:     filepath.Join(dir, "config.json"),
		JobStorePath:   filepath.Join(dir, "jobs.json"),
	})
	pairAs := func(clientID string) string {
		body, _ := json.Marshal(map[string]string{"pairingCode": server.configStore.PairingCode(), "clientId": clientID, "origin": "http://localhost:5173"})
		req := httptest.NewRequest(http.MethodPost, "/v1/pair", bytes.NewReader(body))
		req.Header.Set("Origin", "http://localhost:5173")
		res := httptest.NewRecorder()
		server.Handler().ServeHTTP(res, req)
		if res.Code != http.StatusCreated {
			t.Fatalf("pair %s: expected 201, got %d: %s", clientID, res.Code, res.Body.String())
		}
		var response map[string]any
		_ = json.Unmarshal(res.Body.Bytes(), &response)
		return response["token"].(string)
	}

	// A second browser pairing must NOT invalidate the first — the old
	// single TokenHash design invalidated every existing client on re-pair,
	// which is what forced daily re-pairing on shared workstations.
	tokenA := pairAs("browser-a")
	tokenB := pairAs("browser-b")
	if !server.configStore.Verify(tokenA) || !server.configStore.Verify(tokenB) {
		t.Fatal("both clients should stay paired after a second pairing")
	}

	// Re-pairing the same client rotates only its own token.
	newA := pairAs("browser-a")
	if server.configStore.Verify(tokenA) {
		t.Fatal("re-paired client should replace its own token")
	}
	if !server.configStore.Verify(newA) || !server.configStore.Verify(tokenB) {
		t.Fatal("other clients must survive a same-client re-pair")
	}

	// Disconnect removes only the token presented.
	req := httptest.NewRequest(http.MethodDelete, "/v1/pair", nil)
	req.Header.Set("Authorization", "Bearer "+newA)
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.Code)
	}
	if server.configStore.Verify(newA) {
		t.Fatal("disconnected client's token should stop verifying")
	}
	if !server.configStore.Verify(tokenB) {
		t.Fatal("disconnect must not sign other clients out")
	}
}

func TestListJobsSanitization(t *testing.T) {
	server := newTestServer(t)
	record := JobRecord{Job: Job{ID: "job-1", ClientID: "x", PayloadBase64: "cGF5bG9hZA=="}, Status: JobStatus{ID: "job-1", State: "completed", UpdatedAt: time.Now()}}
	if err := server.jobStore.Put(record); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/jobs", nil)
	req.Header.Set("Authorization", "Bearer secret")
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}
	if strings.Contains(res.Body.String(), "payloadBase64") {
		t.Fatal("payloadBase64 exposed in list response")
	}
	var body map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	jobs, _ := body["jobs"].([]any)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}
}

func TestListJobsFiltersAndLimit(t *testing.T) {
	server := newTestServer(t)
	if err := server.jobStore.Put(JobRecord{Job: Job{ID: "job-a", ClientID: "x"}, Status: JobStatus{ID: "job-a", State: "failed", UpdatedAt: time.Now()}}); err != nil {
		t.Fatal(err)
	}
	if err := server.jobStore.Put(JobRecord{Job: Job{ID: "job-b", ClientID: "y"}, Status: JobStatus{ID: "job-b", State: "completed", UpdatedAt: time.Now()}}); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/jobs?state=failed&clientId=x&limit=5", nil)
	req.Header.Set("Authorization", "Bearer secret")
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	jobs, _ := body["jobs"].([]any)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}
}

func TestRetryJob(t *testing.T) {
	server := newTestServer(t)
	record := JobRecord{Job: Job{ID: "job-r", ClientID: "x", ContentType: "raw", PrinterID: "fake-id", PayloadBase64: "dGVzdA=="}, Status: JobStatus{ID: "job-r", State: "failed", Error: "boom", UpdatedAt: time.Now()}}
	if err := server.jobStore.Put(record); err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/jobs/job-r/retry", nil)
	req.Header.Set("Authorization", "Bearer secret")
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["state"] != "queued" {
		t.Fatalf("expected queued, got %v", body["state"])
	}
	for i := 0; i < 50; i++ {
		latest, _ := server.jobStore.Get("job-r")
		if latest.Status.State != "queued" {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
}

func TestDiagnostics(t *testing.T) {
	server := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/v1/diagnostics", nil)
	req.Header.Set("Authorization", "Bearer secret")
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}
	body := res.Body.String()
	if strings.Contains(body, "configPath") || strings.Contains(body, "jobStorePath") {
		t.Fatal("diagnostics exposed paths")
	}
	var data map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &data); err != nil {
		t.Fatal(err)
	}
	if _, ok := data["queue"]; !ok {
		t.Fatal("missing queue")
	}
	if _, ok := data["client"]; !ok {
		t.Fatal("missing client")
	}
}

func TestPairings(t *testing.T) {
	dir := t.TempDir()
	server := New(Config{AllowedOrigins: []string{"http://localhost:5173"}, ConfigPath: filepath.Join(dir, "config.json"), JobStorePath: filepath.Join(dir, "jobs.json")})
	server.printers = &fakePrinter{list: []printer.Info{{ID: "fake-id", Name: "Fake"}}}
	body, _ := json.Marshal(map[string]string{"pairingCode": server.configStore.PairingCode(), "clientId": "zettaz", "origin": "http://localhost:5173"})
	req := httptest.NewRequest(http.MethodPost, "/v1/pair", bytes.NewReader(body))
	req.Header.Set("Origin", "http://localhost:5173")
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", res.Code, res.Body.String())
	}
	var pair map[string]any
	_ = json.Unmarshal(res.Body.Bytes(), &pair)
	token, _ := pair["token"].(string)
	if token == "" {
		t.Fatal("no token")
	}
	req2 := httptest.NewRequest(http.MethodGet, "/v1/pairings", nil)
	req2.Header.Set("Authorization", "Bearer "+token)
	res2 := httptest.NewRecorder()
	server.Handler().ServeHTTP(res2, req2)
	if res2.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res2.Code, res2.Body.String())
	}
	var data map[string]any
	_ = json.Unmarshal(res2.Body.Bytes(), &data)
	if data["clientId"] != "zettaz" {
		t.Fatalf("unexpected clientId: %v", data["clientId"])
	}
	if data["origin"] != "http://localhost:5173" {
		t.Fatalf("unexpected origin: %v", data["origin"])
	}
	if data["paired"] != true {
		t.Fatalf("unexpected paired: %v", data["paired"])
	}
	if _, ok := data["token"]; ok {
		t.Fatal("token exposed in pairings")
	}
	if _, ok := data["hash"]; ok {
		t.Fatal("hash exposed in pairings")
	}
}

func TestTestPrint(t *testing.T) {
	server := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/v1/printers/fake-id/test", nil)
	req.Header.Set("Authorization", "Bearer secret")
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", res.Code, res.Body.String())
	}
	req2 := httptest.NewRequest(http.MethodPost, "/v1/printers/missing-id/test", nil)
	req2.Header.Set("Authorization", "Bearer secret")
	res2 := httptest.NewRecorder()
	server.Handler().ServeHTTP(res2, req2)
	if res2.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", res2.Code)
	}
}
