package agent

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"
)

const (
	maxResponseBody = 1 << 20 // 1 MiB
	requestTimeout  = 15 * time.Second
)

type CloudClient struct {
	baseURL     string
	deviceToken string
	client      *http.Client
	mu          sync.RWMutex
}

type CloudEnrollRequest struct {
	Code         string `json:"code"`
	AgentID      string `json:"agent_id"`
	DisplayName  string `json:"display_name"`
	Version      string `json:"version"`
	Platform     string `json:"platform"`
	OSVersion    string `json:"os_version"`
	Architecture string `json:"architecture"`
}

type CloudEnrollResponse struct {
	AgentID     string `json:"agentId"`
	DeviceToken string `json:"deviceToken"`
}

type HeartbeatRequest struct {
	Version       string         `json:"version"`
	Platform      string         `json:"platform"`
	Architecture  string         `json:"architecture"`
	OSVersion     string         `json:"os_version"`
	Printers      PrinterSummary `json:"capabilities"`
	Queue         QueueSummary   `json:"queue_counts"`
	LastError     string         `json:"last_error,omitempty"`
	UpdateChannel string         `json:"-"`
}

type PrinterSummary struct {
	Total       int            `json:"total"`
	ByType      map[string]int `json:"byType"`
	ByMediaSize map[string]int `json:"byMediaSize"`
}

type QueueSummary struct {
	Total      int `json:"total"`
	Queued     int `json:"queued"`
	Processing int `json:"processing"`
	Completed  int `json:"completed"`
	Failed     int `json:"failed"`
	Cancelled  int `json:"cancelled"`
}

type CloudConfiguration struct {
	AgentID                  string           `json:"agentId,omitempty"`
	TenantID                 string           `json:"tenantId,omitempty"`
	StoreID                  string           `json:"storeId,omitempty"`
	HeartbeatIntervalSeconds int              `json:"heartbeatIntervalSeconds"`
	UpdateChannel            string           `json:"updateChannel,omitempty"`
	NotificationPolicy       string           `json:"notificationPolicy,omitempty"`
	ConfigPolicy             string           `json:"configPolicy,omitempty"`
	WorkstationOverrides     map[string]any   `json:"workstationOverrides,omitempty"`
	PrinterMappings          []map[string]any `json:"printerMappings,omitempty"`
}

func NewCloudClient(baseURL, deviceToken string) *CloudClient {
	return newCloudClientWithHTTP(baseURL, deviceToken, &http.Client{
		Timeout: requestTimeout,
		Transport: &http.Transport{
			TLSClientConfig:     &tls.Config{MinVersion: tls.VersionTLS12},
			Proxy:               http.ProxyFromEnvironment,
			DialContext:         (&net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
			TLSHandshakeTimeout: 10 * time.Second,
		},
	})
}

func newCloudClientWithHTTP(baseURL, deviceToken string, client *http.Client) *CloudClient {
	return &CloudClient{baseURL: strings.TrimRight(baseURL, "/"), deviceToken: deviceToken, client: client}
}

func (c *CloudClient) SetDeviceToken(token string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.deviceToken = token
}

func (c *CloudClient) DeviceToken() string {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.deviceToken
}

func (c *CloudClient) Enroll(ctx context.Context, req CloudEnrollRequest) (CloudEnrollResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return CloudEnrollResponse{}, err
	}
	url := c.baseURL + "/api/print-agent-connect/enroll"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return CloudEnrollResponse{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	raw, err := c.do(httpReq)
	if err != nil {
		return CloudEnrollResponse{}, err
	}
	var envelope struct {
		Data struct {
			AgentID string `json:"agent_id"`
			Token   string `json:"token"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return CloudEnrollResponse{}, err
	}
	resp := CloudEnrollResponse{AgentID: envelope.Data.AgentID, DeviceToken: envelope.Data.Token}
	if resp.AgentID == "" || resp.DeviceToken == "" {
		return CloudEnrollResponse{}, fmt.Errorf("enroll response missing agentId or deviceToken")
	}
	return resp, nil
}

func (c *CloudClient) Heartbeat(ctx context.Context, req HeartbeatRequest) error {
	body, err := json.Marshal(req)
	if err != nil {
		return err
	}
	url := c.baseURL + "/api/print-agent-connect/heartbeat"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.DeviceToken())
	_, err = c.do(httpReq)
	return err
}

func (c *CloudClient) GetConfiguration(ctx context.Context) (CloudConfiguration, error) {
	url := c.baseURL + "/api/print-agent-connect/configuration"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return CloudConfiguration{}, err
	}
	httpReq.Header.Set("Accept", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.DeviceToken())
	raw, err := c.do(httpReq)
	if err != nil {
		return CloudConfiguration{}, err
	}
	var envelope struct {
		Data struct {
			AgentID              string           `json:"agent_id"`
			TenantID             string           `json:"tenant_id"`
			StoreID              string           `json:"store_id"`
			HeartbeatInterval    int              `json:"heartbeat_interval"`
			UpdateChannel        string           `json:"update_channel"`
			NotificationPolicy   string           `json:"notification_policy"`
			ConfigPolicy         string           `json:"config_policy"`
			WorkstationOverrides map[string]any   `json:"workstation_overrides"`
			PrinterMappings      []map[string]any `json:"printer_mappings"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return CloudConfiguration{}, err
	}
	return CloudConfiguration{
		AgentID: envelope.Data.AgentID, TenantID: envelope.Data.TenantID, StoreID: envelope.Data.StoreID,
		HeartbeatIntervalSeconds: envelope.Data.HeartbeatInterval, UpdateChannel: envelope.Data.UpdateChannel,
		NotificationPolicy: envelope.Data.NotificationPolicy, ConfigPolicy: envelope.Data.ConfigPolicy,
		WorkstationOverrides: envelope.Data.WorkstationOverrides, PrinterMappings: envelope.Data.PrinterMappings,
	}, nil
}

func (c *CloudClient) do(req *http.Request) ([]byte, error) {
	resp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	limited := io.LimitReader(resp.Body, maxResponseBody)
	raw, err := io.ReadAll(limited)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("cloud request failed: %d %s", resp.StatusCode, http.StatusText(resp.StatusCode))
	}
	return raw, nil
}

func ValidateCloudURL(input string) error {
	u, err := url.Parse(input)
	if err != nil {
		return err
	}
	if u.Scheme != "https" && u.Scheme != "http" {
		return fmt.Errorf("cloud URL scheme must be https or http")
	}
	if u.Scheme == "http" {
		if !isDevelopment() {
			return fmt.Errorf("cloud URL must use https in non-development environments")
		}
		host := u.Hostname()
		if !isLoopback(host) {
			return fmt.Errorf("http cloud URL is only permitted for loopback in development")
		}
	}
	return nil
}

func isDevelopment() bool {
	d := strings.ToLower(strings.TrimSpace(os.Getenv("ZETTAZ_AGENT_DEV")))
	return d == "1" || d == "true" || d == "yes"
}

func isLoopback(host string) bool {
	if host == "" || host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func RuntimeOSVersion() string {
	// Sanitized: only expose platform and architecture, no build details or paths.
	return fmt.Sprintf("%s/%s", runtime.GOOS, runtime.GOARCH)
}
