package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"runtime"
	"strings"
	"time"
)

type fleetEnrollRequest struct {
	CloudBaseURL string `json:"cloudBaseURL"`
	Code         string `json:"code"`
	DisplayName  string `json:"displayName"`
}

type fleetStatus struct {
	Enrolled      bool   `json:"enrolled"`
	AgentID       string `json:"agentId,omitempty"`
	DisplayName   string `json:"displayName,omitempty"`
	CloudBaseURL  string `json:"cloudBaseURL,omitempty"`
	UpdateChannel string `json:"updateChannel,omitempty"`
}

func (s *Server) fleetEnroll(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
		return
	}
	if s.configStore == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "fleet enrollment is unavailable"})
		return
	}
	var req fleetEnrollRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "invalid JSON"})
		return
	}
	if req.CloudBaseURL == "" || req.Code == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "cloudBaseURL and code are required"})
		return
	}
	if err := ValidateCloudURL(req.CloudBaseURL); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": err.Error()})
		return
	}
	displayName := strings.TrimSpace(req.DisplayName)
	if displayName == "" {
		if host, err := os.Hostname(); err == nil && host != "" {
			displayName = host
		} else {
			displayName = "Zettaz Print Agent"
		}
	}
	agentID := s.configStore.AgentID()
	client := NewCloudClient(req.CloudBaseURL, "")
	resp, err := client.Enroll(r.Context(), CloudEnrollRequest{
		Code:         req.Code,
		AgentID:      agentID,
		DisplayName:  displayName,
		Version:      Version,
		Platform:     runtime.GOOS,
		OSVersion:    RuntimeOSVersion(),
		Architecture: runtime.GOARCH,
	})
	if err != nil {
		log.Printf("fleet enrollment failed: %s", err.Error())
		writeJSON(w, http.StatusBadGateway, map[string]string{"message": "enrollment failed"})
		return
	}
	if err := s.configStore.SetFleetEnrollment(req.CloudBaseURL, resp.AgentID, displayName, resp.DeviceToken, ""); err != nil {
		log.Printf("fleet enrollment persistence failed: %s", err.Error())
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "could not persist enrollment"})
		return
	}
	s.setCloudClient(NewCloudClient(req.CloudBaseURL, resp.DeviceToken))
	s.maybeStartFleetLoop()
	writeJSON(w, http.StatusCreated, fleetStatus{
		Enrolled:      true,
		AgentID:       resp.AgentID,
		DisplayName:   displayName,
		CloudBaseURL:  req.CloudBaseURL,
		UpdateChannel: "",
	})
}

func (s *Server) fleetStatus(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
		return
	}
	if s.configStore == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "fleet status is unavailable"})
		return
	}
	baseURL, agentID, displayName, _, updateChannel, enrolled := s.configStore.FleetEnrolled()
	writeJSON(w, http.StatusOK, fleetStatus{
		Enrolled:      enrolled,
		AgentID:       agentID,
		DisplayName:   displayName,
		CloudBaseURL:  baseURL,
		UpdateChannel: updateChannel,
	})
}

func (s *Server) fleetRevoke(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
		return
	}
	if s.configStore == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "fleet enrollment is unavailable"})
		return
	}
	s.setCloudClient(nil)
	if err := s.stopFleetLoop(); err != nil {
		log.Printf("fleet stop error: %s", err.Error())
	}
	if err := s.configStore.RevokeFleetEnrollment(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "could not revoke enrollment"})
		return
	}
	writeJSON(w, http.StatusOK, fleetStatus{Enrolled: false})
}

func (s *Server) fleetConfiguration(w http.ResponseWriter, r *http.Request) {
	if !s.authorized(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "unauthorized"})
		return
	}
	s.cloudConfigMu.RLock()
	cfg := s.cloudConfig
	s.cloudConfigMu.RUnlock()
	writeJSON(w, http.StatusOK, cfg)
}

func (s *Server) setCloudClient(client *CloudClient) {
	s.cloudConfigMu.Lock()
	defer s.cloudConfigMu.Unlock()
	s.cloudClient = client
}

func (s *Server) getCloudClient() *CloudClient {
	s.cloudConfigMu.RLock()
	defer s.cloudConfigMu.RUnlock()
	return s.cloudClient
}

func (s *Server) maybeStartFleetLoop() {
	s.cloudConfigMu.Lock()
	defer s.cloudConfigMu.Unlock()
	if s.cloudClient == nil || s.fleetRunning {
		return
	}
	if s.fleetCtx == nil || s.fleetCtx.Err() != nil {
		s.fleetCtx, s.fleetCancel = context.WithCancel(context.Background())
	}
	s.fleetRunning = true
	s.fleetWg.Add(1)
	go s.runFleetLoop(s.fleetCtx)
}

func (s *Server) stopFleetLoop() error {
	s.cloudConfigMu.Lock()
	cancel := s.fleetCancel
	s.fleetRunning = false
	if s.fleetCtx != nil {
		s.fleetCtx, s.fleetCancel = context.WithCancel(context.Background())
	}
	s.cloudConfigMu.Unlock()
	if cancel == nil {
		return nil
	}
	cancel()
	done := make(chan struct{})
	go func() { defer close(done); s.fleetWg.Wait() }()
	select {
	case <-done:
		return nil
	case <-time.After(20 * time.Second):
		return fmt.Errorf("fleet loop did not stop in time")
	}
}

func (s *Server) runFleetLoop(ctx context.Context) {
	defer func() {
		s.cloudConfigMu.Lock()
		s.fleetRunning = false
		s.cloudConfigMu.Unlock()
		s.fleetWg.Done()
	}()
	interval := 60 * time.Second
	for {
		s.tickFleet(ctx)
		select {
		case <-ctx.Done():
			return
		case <-time.After(interval):
		}
		client := s.getCloudClient()
		if client == nil {
			return
		}
		newInterval, err := s.fetchCloudConfiguration(ctx)
		if err == nil && newInterval > 0 {
			interval = clampHeartbeatInterval(newInterval)
		}
	}
}

func (s *Server) tickFleet(ctx context.Context) {
	client := s.getCloudClient()
	if client == nil {
		return
	}
	req := s.buildHeartbeat()
	if err := client.Heartbeat(ctx, req); err != nil {
		log.Printf("fleet heartbeat failed: %s", err.Error())
	}
}

func (s *Server) fetchCloudConfiguration(ctx context.Context) (time.Duration, error) {
	client := s.getCloudClient()
	if client == nil {
		return 0, fmt.Errorf("not enrolled")
	}
	cfg, err := client.GetConfiguration(ctx)
	if err != nil {
		return 0, err
	}
	s.cloudConfigMu.Lock()
	s.cloudConfig = cfg
	s.cloudConfigMu.Unlock()
	if cfg.UpdateChannel != "" && s.configStore != nil {
		if _, _, _, _, _, ok := s.configStore.FleetEnrolled(); ok {
			_ = s.configStore.updateFleetChannel(cfg.UpdateChannel)
		}
	}
	return time.Duration(cfg.HeartbeatIntervalSeconds) * time.Second, nil
}

func (s *Server) buildHeartbeat() HeartbeatRequest {
	_, _, _, _, updateChannel, _ := s.configStore.FleetEnrolled()
	req := HeartbeatRequest{
		Version:       Version,
		Platform:      runtime.GOOS,
		Architecture:  runtime.GOARCH,
		OSVersion:     RuntimeOSVersion(),
		UpdateChannel: updateChannel,
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	items, err := s.printers.List(ctx)
	if err != nil {
		req.LastError = sanitizeError(err.Error())
	} else {
		req.Printers.Total = len(items)
		req.Printers.ByType = map[string]int{}
		req.Printers.ByMediaSize = map[string]int{}
		for _, p := range items {
			for _, ct := range p.ContentTypes {
				req.Printers.ByType[ct]++
			}
			for _, ms := range p.MediaSizes {
				req.Printers.ByMediaSize[ms]++
			}
		}
	}
	if s.jobStore != nil {
		stats := s.jobStore.Stats()
		req.Queue = QueueSummary(stats)
		if last := s.jobStore.LastFailedError(); last != "" {
			req.LastError = sanitizeError(last)
		}
	}
	return req
}

func clampHeartbeatInterval(d time.Duration) time.Duration {
	const minInterval = 15 * time.Second
	const maxInterval = 24 * time.Hour
	if d < minInterval {
		return minInterval
	}
	if d > maxInterval {
		return maxInterval
	}
	return d
}

func sanitizeError(input string) string {
	if input == "" {
		return ""
	}
	home, _ := os.UserHomeDir()
	out := input
	if home != "" {
		out = strings.ReplaceAll(out, home, "~")
	}
	// Redact anything that looks like a bearer token in the error text.
	out = redactBearer(out)
	out = strings.Join(strings.Fields(out), " ")
	if len(out) > 200 {
		out = out[:200]
	}
	return out
}

func redactBearer(input string) string {
	var out strings.Builder
	for {
		i := strings.Index(input, "Bearer ")
		if i == -1 {
			out.WriteString(input)
			break
		}
		out.WriteString(input[:i])
		out.WriteString("Bearer [redacted]")
		rest := input[i+len("Bearer "):]
		j := 0
		for j < len(rest) && (rest[j] != ' ' && rest[j] != '\t' && rest[j] != '\n' && rest[j] != '\r') {
			j++
		}
		input = rest[j:]
	}
	return out.String()
}
