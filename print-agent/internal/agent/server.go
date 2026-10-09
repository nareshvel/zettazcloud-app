package agent

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/zettaz/print-agent/internal/printer"
)

var Version = "2.0.0-dev"

type Config struct {
	Address        string
	Token          string
	AllowedOrigins []string
	ConfigPath     string
	JobStorePath   string
}

type Server struct {
	config        Config
	printers      printer.System
	configStore   *ConfigStore
	jobStore      *JobStore
	cancelMu      sync.Mutex
	cancels       map[string]context.CancelFunc
	httpServer    *http.Server
	cloudClient   *CloudClient
	cloudConfigMu sync.RWMutex
	cloudConfig   CloudConfiguration
	fleetCtx      context.Context
	fleetCancel   context.CancelFunc
	fleetWg       sync.WaitGroup
	fleetRunning  bool
	pairMu        sync.Mutex
	pairFails     int
	pairBlocked   time.Time
}

type Job struct {
	ID            string `json:"id"`
	ClientID      string `json:"clientId"`
	Destination   string `json:"destination"`
	PrinterID     string `json:"printerId"`
	Address       string `json:"address"`
	ContentType   string `json:"contentType"`
	PayloadBase64 string `json:"payloadBase64"`
	Copies        int    `json:"copies"`
	MediaSize     string `json:"mediaSize"`
}

type JobStatus struct {
	ID        string    `json:"id"`
	State     string    `json:"state"`
	Error     string    `json:"error,omitempty"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type JobSummary struct {
	ID          string    `json:"id"`
	ClientID    string    `json:"clientId"`
	Destination string    `json:"destination"`
	PrinterID   string    `json:"printerId"`
	Address     string    `json:"address"`
	ContentType string    `json:"contentType"`
	Copies      int       `json:"copies"`
	MediaSize   string    `json:"mediaSize"`
	State       string    `json:"state"`
	Error       string    `json:"error,omitempty"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func New(config Config) *Server {
	if config.Address == "" {
		config.Address = "127.0.0.1:9419"
	}
	if config.ConfigPath == "" {
		config.ConfigPath = os.TempDir() + "/zettaz-print-agent-config.json"
	}
	if config.JobStorePath == "" {
		config.JobStorePath = os.TempDir() + "/zettaz-print-agent-jobs.json"
	}
	configStore, err := NewConfigStore(config.ConfigPath, config.AllowedOrigins)
	if err != nil {
		log.Printf("config store unavailable: %v", err)
	}
	jobStore, err := NewJobStore(config.JobStorePath)
	if err != nil {
		log.Printf("job store unavailable: %v", err)
		jobStore, _ = NewJobStore(os.TempDir() + "/zettaz-print-agent-jobs-fallback.json")
	}
	if jobStore != nil {
		_ = jobStore.Purge(time.Now().Add(-7 * 24 * time.Hour))
	}
	s := &Server{config: config, printers: printer.NewSystem(), configStore: configStore, jobStore: jobStore, cancels: map[string]context.CancelFunc{}}
	s.fleetCtx, s.fleetCancel = context.WithCancel(context.Background())
	if configStore != nil {
		_ = configStore.AgentID()
		if baseURL, _, _, token, _, ok := configStore.FleetEnrolled(); ok {
			s.cloudClient = NewCloudClient(baseURL, token)
		}
	}
	return s
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", s.pairingPage)
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("GET /printers", s.listPrinters)
	mux.HandleFunc("GET /v1/health", s.health)
	mux.HandleFunc("POST /v1/pair", s.pair)
	mux.HandleFunc("DELETE /v1/pair", s.unpair)
	mux.HandleFunc("GET /v1/pairings", s.getPairings)
	mux.HandleFunc("GET /v1/printers", s.listPrinters)
	mux.HandleFunc("POST /v1/printers/{id}/test", s.testPrint)
	mux.HandleFunc("POST /v1/jobs", s.createJob)
	mux.HandleFunc("GET /v1/jobs", s.listJobs)
	mux.HandleFunc("GET /v1/jobs/{id}", s.getJob)
	mux.HandleFunc("POST /v1/jobs/{id}/cancel", s.cancelJob)
	mux.HandleFunc("POST /v1/jobs/{id}/retry", s.retryJob)
	mux.HandleFunc("GET /v1/diagnostics", s.diagnostics)
	mux.HandleFunc("POST /v1/fleet/enroll", s.fleetEnroll)
	mux.HandleFunc("GET /v1/fleet/status", s.fleetStatus)
	mux.HandleFunc("DELETE /v1/fleet/enrollment", s.fleetRevoke)
	mux.HandleFunc("GET /v1/fleet/configuration", s.fleetConfiguration)
	return s.securityHeaders(s.cors(s.limitBody(mux)))
}

func (s *Server) ListenAndServe() error {
	log.Printf("Zettaz Print Agent %s listening on http://%s", Version, s.config.Address)
	if s.configStore != nil && !s.configStore.IsPaired() {
		log.Printf("Pairing code: %s", s.configStore.PairingCode())
	}
	if s.jobStore != nil {
		for _, record := range s.jobStore.ListRecoverable() {
			go s.processJob(record)
		}
	}
	s.maybeStartFleetLoop()
	s.httpServer = &http.Server{Addr: s.config.Address, Handler: s.Handler(), ReadHeaderTimeout: 10 * time.Second}
	return s.httpServer.ListenAndServe()
}

func (s *Server) Shutdown() error {
	err := s.stopFleetLoop()
	if s.httpServer == nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if se := s.httpServer.Shutdown(ctx); se != nil && err == nil {
		err = se
	}
	return err
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	paired := s.config.Token != "" || (s.configStore != nil && s.configStore.IsPaired())
	response := map[string]any{"status": "ok", "agent": "zettaz-print-agent", "version": Version, "platform": runtime.GOOS, "paired": paired}
	// The pairing code is the secret that grants a client access — it must
	// not be broadcast to arbitrary websites. /v1/health is deliberately
	// open to every origin (discovery before pairing), so the code only
	// rides along for requests without an Origin (CLI/curl/the agent's own
	// local page) or from an origin the agent already trusts.
	if s.configStore != nil && s.originTrusted(r.Header.Get("Origin")) {
		response["pairingCode"] = s.configStore.PairingCode()
	}
	if s.jobStore != nil {
		response["queue"] = s.jobStore.Stats()
	}
	if items, err := s.printers.List(r.Context()); err == nil {
		response["printerCount"] = len(items)
	}
	writeJSON(w, http.StatusOK, response)
}

func (s *Server) listPrinters(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
		return
	}
	items, err := s.printers.List(r.Context())
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"message": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"printers": items})
}

func (s *Server) createJob(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
		return
	}
	var job Job
	if err := json.NewDecoder(r.Body).Decode(&job); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid JSON"})
		return
	}
	if job.ID == "" || job.ClientID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "id and clientId are required"})
		return
	}
	if existing, ok := s.jobStore.Get(job.ID); ok {
		writeJSON(w, http.StatusOK, existing.Status)
		return
	}
	if job.Copies < 1 {
		job.Copies = 1
	}
	if job.Copies > 10 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "copies must be between 1 and 10"})
		return
	}
	allowed := map[string]bool{"pdf": true, "escpos": true, "zpl": true, "tspl": true}
	if !allowed[job.ContentType] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "unsupported contentType"})
		return
	}
	payload, err := base64.StdEncoding.DecodeString(job.PayloadBase64)
	if err != nil || len(payload) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "payloadBase64 is required"})
		return
	}
	if len(payload) > 16<<20 {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"message": "payload exceeds 16 MiB"})
		return
	}
	record := JobRecord{Job: job, Status: JobStatus{ID: job.ID, State: "queued", UpdatedAt: time.Now().UTC()}}
	if err := s.jobStore.Put(record); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "could not persist job"})
		return
	}
	go s.processJob(record)
	writeJSON(w, http.StatusAccepted, record.Status)
}

func (s *Server) processJob(record JobRecord) {
	if record.Cancelled {
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.cancelMu.Lock()
	s.cancels[record.Job.ID] = cancel
	s.cancelMu.Unlock()
	defer func() { cancel(); s.cancelMu.Lock(); delete(s.cancels, record.Job.ID); s.cancelMu.Unlock() }()
	payload, err := base64.StdEncoding.DecodeString(record.Job.PayloadBase64)
	for attempt := record.Attempts + 1; attempt <= 3; attempt++ {
		if latest, ok := s.jobStore.Get(record.Job.ID); ok && latest.Cancelled {
			return
		}
		record.Attempts = attempt
		record.Status = JobStatus{ID: record.Job.ID, State: "processing", UpdatedAt: time.Now().UTC()}
		_ = s.jobStore.Put(record)
		jobCtx, timeout := context.WithTimeout(ctx, 30*time.Second)
		switch record.Job.Destination {
		case "system":
			err = s.printers.Print(jobCtx, record.Job.PrinterID, record.Job.ContentType, payload, record.Job.Copies, record.Job.MediaSize)
		case "tcp":
			for i := 0; i < record.Job.Copies && err == nil; i++ {
				err = printer.PrintTCP(jobCtx, record.Job.Address, payload)
			}
		default:
			err = fmt.Errorf("destination must be system or tcp")
		}
		timeout()
		if err == nil {
			record.Status = JobStatus{ID: record.Job.ID, State: "completed", UpdatedAt: time.Now().UTC()}
			_ = s.jobStore.Put(record)
			return
		}
		if attempt < 3 {
			select {
			case <-ctx.Done():
				return
			case <-time.After(time.Duration(attempt) * time.Second):
			}
		}
	}
	record.Status = JobStatus{ID: record.Job.ID, State: "failed", Error: err.Error(), UpdatedAt: time.Now().UTC()}
	_ = s.jobStore.Put(record)
}

func (s *Server) getJob(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
		return
	}
	record, ok := s.jobStore.Get(r.PathValue("id"))
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "job not found"})
		return
	}
	writeJSON(w, http.StatusOK, record.Status)
}

func (s *Server) listJobs(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
		return
	}
	if s.jobStore == nil {
		writeJSON(w, http.StatusOK, map[string]any{"jobs": []JobSummary{}})
		return
	}
	state := r.URL.Query().Get("state")
	clientID := r.URL.Query().Get("clientId")
	limit := 100
	if n, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil {
		if n > 0 && n <= 1000 {
			limit = n
		} else if n > 1000 {
			limit = 1000
		}
	}
	records := s.jobStore.List(state, clientID, limit)
	summaries := make([]JobSummary, len(records))
	for i, rec := range records {
		summaries[i] = jobSummary(rec)
	}
	writeJSON(w, http.StatusOK, map[string]any{"jobs": summaries})
}

func (s *Server) cancelJob(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
		return
	}
	record, err := s.jobStore.Cancel(r.PathValue("id"))
	if os.IsNotExist(err) {
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "job not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"message": err.Error()})
		return
	}
	s.cancelMu.Lock()
	if cancel := s.cancels[record.Job.ID]; cancel != nil {
		cancel()
	}
	s.cancelMu.Unlock()
	writeJSON(w, http.StatusOK, record.Status)
}

func (s *Server) retryJob(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
		return
	}
	record, err := s.jobStore.Retry(r.PathValue("id"))
	if os.IsNotExist(err) {
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "job not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"message": err.Error()})
		return
	}
	go s.processJob(record)
	writeJSON(w, http.StatusOK, record.Status)
}

func (s *Server) testPrint(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	items, err := s.printers.List(ctx)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"message": err.Error()})
		return
	}
	id := r.PathValue("id")
	found := false
	for _, p := range items {
		if p.ID == id {
			found = true
			break
		}
	}
	if !found {
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "printer not found"})
		return
	}
	if err := s.printers.Print(ctx, id, "raw", []byte("Zettaz Print Agent test\r\n\r\n"), 1, ""); err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"message": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"state": "ok"})
}

func (s *Server) authorized(r *http.Request) bool {
	if os.Getenv("ZETTAZ_AGENT_ALLOW_UNPAIRED") == "true" {
		return true
	}
	provided := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	if s.config.Token != "" {
		return len(provided) == len(s.config.Token) && subtle.ConstantTimeCompare([]byte(provided), []byte(s.config.Token)) == 1
	}
	return s.configStore != nil && s.configStore.Verify(provided)
}

func (s *Server) pair(w http.ResponseWriter, r *http.Request) {
	if s.configStore == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "pairing is unavailable"})
		return
	}
	var request struct {
		PairingCode string `json:"pairingCode"`
		ClientID    string `json:"clientId"`
		Origin      string `json:"origin"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid JSON"})
		return
	}
	origin := r.Header.Get("Origin")
	if request.Origin == "" {
		request.Origin = origin
	}
	if origin != "" && request.Origin != origin {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "origin mismatch"})
		return
	}
	// /v1/pair is reachable from every origin by design (a new client cannot
	// pair otherwise), so the 6-digit code is the only credential — throttle
	// failures to make brute-force impractical over localhost.
	s.pairMu.Lock()
	if time.Now().Before(s.pairBlocked) {
		retry := int(time.Until(s.pairBlocked).Seconds()) + 1
		s.pairMu.Unlock()
		writeJSON(w, http.StatusTooManyRequests, map[string]any{"message": "too many failed pairing attempts", "retryAfterSeconds": retry})
		return
	}
	s.pairMu.Unlock()
	token, err := s.configStore.Pair(request.PairingCode, request.ClientID, request.Origin)
	if err != nil {
		s.pairMu.Lock()
		s.pairFails++
		if s.pairFails >= 5 {
			s.pairBlocked = time.Now().Add(60 * time.Second)
			s.pairFails = 0
		}
		s.pairMu.Unlock()
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": err.Error()})
		return
	}
	s.pairMu.Lock()
	s.pairFails = 0
	s.pairMu.Unlock()
	writeJSON(w, http.StatusCreated, map[string]any{"token": token, "paired": true})
}

func (s *Server) unpair(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
		return
	}
	if s.configStore == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "pairing is unavailable"})
		return
	}
	// Multi-client: disconnect only the client presenting this token — other
	// browsers/profiles paired to the same agent stay connected.
	provided := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	if err := s.configStore.UnpairByToken(provided); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"paired": false})
}

func (s *Server) getPairings(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
		return
	}
	clientID, origin, paired := "", "", false
	var clients []ClientConfig
	if s.configStore != nil {
		clientID, origin, paired = s.configStore.Pairing()
		clients = s.configStore.Pairings()
	}
	writeJSON(w, http.StatusOK, map[string]any{"clientId": clientID, "origin": origin, "paired": paired, "clients": clients})
}

func (s *Server) diagnostics(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
		return
	}
	items, printerErr := s.printers.List(r.Context())
	paired := s.config.Token != "" || (s.configStore != nil && s.configStore.IsPaired())
	queue := JobStats{}
	if s.jobStore != nil {
		queue = s.jobStore.Stats()
	}
	client := map[string]any{"clientId": "", "origin": "", "paired": false}
	if s.configStore != nil {
		clientID, origin, _ := s.configStore.Pairing()
		client["clientId"] = clientID
		client["origin"] = origin
		client["paired"] = clientID != "" && origin != ""
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok", "version": Version, "platform": runtime.GOOS, "listen": s.config.Address,
		"paired": paired, "printerCount": len(items), "printerError": errorText(printerErr),
		"queue": queue, "client": client,
		"checks": []map[string]any{
			{"name": "printer enumeration", "passed": printerErr == nil, "message": errorText(printerErr)},
			{"name": "durable job store", "passed": s.jobStore != nil},
		},
	})
}

func jobSummary(record JobRecord) JobSummary {
	return JobSummary{
		ID: record.Job.ID, ClientID: record.Job.ClientID, Destination: record.Job.Destination,
		PrinterID: record.Job.PrinterID, Address: record.Job.Address, ContentType: record.Job.ContentType,
		Copies: record.Job.Copies, MediaSize: record.Job.MediaSize, State: record.Status.State,
		Error: record.Status.Error, UpdatedAt: record.Status.UpdatedAt,
	}
}

func errorText(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

// originTrusted reports whether the given Origin header value may see
// pairing-level information. An empty Origin (CLI, curl, or the agent's own
// local page loaded via same-origin navigation) is trusted — cross-origin
// browser requests always carry an Origin, which must be in the baseline or
// a pairing-grown list.
func (s *Server) originTrusted(origin string) bool {
	if origin == "" {
		return true
	}
	for _, o := range s.config.AllowedOrigins {
		if strings.TrimSpace(o) == origin {
			return true
		}
	}
	if s.configStore != nil {
		for _, trusted := range s.configStore.Origins() {
			if strings.TrimSpace(trusted) == origin {
				return true
			}
		}
	}
	return false
}

// pairingPage is a minimal local UI served at http://127.0.0.1:<port>/ —
// reachable by direct browser navigation (no Origin header), so users can
// read the pairing code even when their app origin isn't trusted yet.
func (s *Server) pairingPage(w http.ResponseWriter, r *http.Request) {
	paired := s.config.Token != "" || (s.configStore != nil && s.configStore.IsPaired())
	clients := 0
	code := ""
	if s.configStore != nil {
		code = s.configStore.PairingCode()
		clients = len(s.configStore.Pairings())
	}
	status := "Not paired"
	if paired {
		status = fmt.Sprintf("Paired (%d clients)", clients)
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprintf(w, `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zettaz Print Agent</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:520px;margin:48px auto;padding:0 16px;color:#1a1a1a}
.code{font-size:40px;font-weight:700;letter-spacing:8px;text-align:center;background:#f4f4f5;border-radius:12px;padding:18px;margin:16px 0}
.meta{color:#666;font-size:14px}</style></head><body>
<h1>Zettaz Print Agent</h1>
<p class="meta">Version %s · %s · listening on %s</p>
<p><strong>Status:</strong> %s</p>
<h2>Pairing code</h2>
<div class="code">%s</div>
<p class="meta">Enter this code in the Zettaz Cloud app (Print Agent page) to connect this computer. The code changes after each pairing.</p>
</body></html>`, Version, runtime.GOOS, s.config.Address, status, code)
}

func (s *Server) cors(next http.Handler) http.Handler {
	// Baseline origins are fixed at process startup (ZETTAZ_AGENT_ALLOWED_ORIGINS).
	// This used to be the ONLY list checked — meaning pairing from a new origin
	// could never actually widen access at runtime, since Pair() wrote to a
	// completely different, unrelated list (ConfigStore's persisted
	// AllowedOrigins) that this middleware never read. A device paired once
	// from production and then opened from local dev (or a second
	// workstation) would get a flat 403 with no way to fix it short of
	// restarting the agent with a different env var. Checking both the
	// static baseline AND the persisted, pairing-grown list together is what
	// makes additive pairing (see ConfigStore.Pair) actually take effect.
	baseline := map[string]bool{}
	for _, origin := range s.config.AllowedOrigins {
		baseline[strings.TrimSpace(origin)] = true
	}
	// /health and /v1/health are liveness/discovery checks a page runs to
	// find out whether the agent exists at all — including a page whose
	// origin has never been trusted yet. Gating them by origin created a
	// chicken-and-egg problem: an untrusted origin can't pass the health
	// check to ever reach the point of pairing, so it's stuck on
	// "not detected" forever with no path forward except editing the
	// static ZETTAZ_AGENT_ALLOWED_ORIGINS env var and restarting the agent.
	// /v1/pair is exempt for the same reason — its own real security
	// boundary is the one-time pairing code (see ConfigStore.Pair), not the
	// origin allowlist, since establishing trust in a *new* origin is
	// exactly what it's for. Nothing else is exempt: printers, jobs,
	// diagnostics, and unpair all still require an already-trusted origin.
	openPaths := map[string]bool{
		"/health":    true,
		"/v1/health": true,
		"/v1/pair":   true,
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowedNow := baseline[origin] || openPaths[r.URL.Path]
		if !allowedNow && origin != "" {
			allowedNow = s.originTrusted(origin)
		}
		if origin != "" && !allowedNow {
			writeJSON(w, http.StatusForbidden, map[string]string{"message": "origin not allowed"})
			return
		}
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		if strings.EqualFold(r.Header.Get("Access-Control-Request-Private-Network"), "true") {
			w.Header().Set("Access-Control-Allow-Private-Network", "true")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) limitBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 24<<20)
		next.ServeHTTP(w, r)
	})
}
func (s *Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}
func writeJSON(w http.ResponseWriter, code int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(value)
}
