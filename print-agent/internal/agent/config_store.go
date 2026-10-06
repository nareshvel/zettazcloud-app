package agent

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

type FleetConfig struct {
	AgentID       string `json:"agentId,omitempty"`
	DisplayName   string `json:"displayName,omitempty"`
	CloudBaseURL  string `json:"cloudBaseURL,omitempty"`
	DeviceToken   string `json:"deviceToken,omitempty"`
	UpdateChannel string `json:"updateChannel,omitempty"`
}

type PersistentConfig struct {
	TokenHash      string      `json:"tokenHash,omitempty"`
	ClientID       string      `json:"clientId,omitempty"`
	AllowedOrigins []string    `json:"allowedOrigins,omitempty"`
	PairingCode    string      `json:"pairingCode"`
	Fleet          FleetConfig `json:"fleet,omitempty"`
}

type ConfigStore struct {
	mu          sync.Mutex
	path        string
	data        PersistentConfig
	pairingCode string
}

func NewConfigStore(path string, defaultOrigins []string) (*ConfigStore, error) {
	store := &ConfigStore{path: path, data: PersistentConfig{AllowedOrigins: defaultOrigins}}
	if raw, err := os.ReadFile(path); err == nil && len(raw) > 0 {
		if err := json.Unmarshal(raw, &store.data); err != nil {
			return nil, err
		}
	} else if err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	if store.data.PairingCode == "" {
		store.data.PairingCode = randomDigits(6)
		if err := store.saveLocked(); err != nil {
			return nil, err
		}
	}
	store.pairingCode = store.data.PairingCode
	return store, nil
}

func (s *ConfigStore) PairingCode() string { s.mu.Lock(); defer s.mu.Unlock(); return s.pairingCode }
func (s *ConfigStore) IsPaired() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.data.TokenHash != ""
}
func (s *ConfigStore) Origins() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.data.AllowedOrigins...)
}
func (s *ConfigStore) Pairing() (string, string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.data.TokenHash == "" {
		return "", "", false
	}
	// Reports the most recently paired origin for display purposes (e.g. the
	// Print Agent Page's "Connected" summary). Origins accumulate additively
	// now (see Pair()), so this is "primary/most recent", not "the only one" —
	// use Origins() for the full trusted list.
	origin := ""
	if n := len(s.data.AllowedOrigins); n > 0 {
		origin = s.data.AllowedOrigins[n-1]
	}
	return s.data.ClientID, origin, true
}

func (s *ConfigStore) Pair(code, clientID, origin string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if code == "" || code != s.pairingCode {
		return "", fmt.Errorf("invalid pairing code")
	}
	if clientID == "" || origin == "" {
		return "", fmt.Errorf("clientId and origin are required")
	}
	token := randomHex(32)
	s.data.TokenHash = hashToken(token)
	s.data.ClientID = clientID
	// Additive, not a replace: pairing from a new origin (e.g. re-pairing
	// from a local dev URL after already being paired with the production
	// site) used to wipe out every previously-trusted origin, silently
	// locking out whichever page paired first. A device is commonly used
	// from more than one page (production + local dev, or two staff
	// workstations sharing one agent), so trust should accumulate here
	// unless the person explicitly unpairs.
	if !containsOrigin(s.data.AllowedOrigins, origin) {
		s.data.AllowedOrigins = append(s.data.AllowedOrigins, origin)
	}
	s.pairingCode = randomDigits(6)
	s.data.PairingCode = s.pairingCode
	return token, s.saveLocked()
}

func (s *ConfigStore) Unpair() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data.TokenHash, s.data.ClientID = "", ""
	s.pairingCode = randomDigits(6)
	s.data.PairingCode = s.pairingCode
	return s.saveLocked()
}

func (s *ConfigStore) Verify(token string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return token != "" && s.data.TokenHash != "" && hashToken(token) == s.data.TokenHash
}

func (s *ConfigStore) AgentID() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.data.Fleet.AgentID == "" {
		s.data.Fleet.AgentID = randomHex(16)
		_ = s.saveLocked()
	}
	return s.data.Fleet.AgentID
}

func (s *ConfigStore) FleetEnrolled() (baseURL, agentID, displayName, deviceToken, updateChannel string, enrolled bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.data.Fleet.CloudBaseURL == "" || s.data.Fleet.DeviceToken == "" {
		return "", "", "", "", "", false
	}
	return s.data.Fleet.CloudBaseURL, s.data.Fleet.AgentID, s.data.Fleet.DisplayName, s.data.Fleet.DeviceToken, s.data.Fleet.UpdateChannel, true
}

func (s *ConfigStore) SetFleetEnrollment(baseURL, agentID, displayName, deviceToken, updateChannel string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if agentID == "" {
		agentID = s.data.Fleet.AgentID
	}
	if agentID == "" {
		agentID = randomHex(16)
	}
	s.data.Fleet = FleetConfig{
		AgentID:       agentID,
		DisplayName:   displayName,
		CloudBaseURL:  baseURL,
		DeviceToken:   deviceToken,
		UpdateChannel: updateChannel,
	}
	return s.saveLocked()
}

func (s *ConfigStore) RevokeFleetEnrollment() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data.Fleet = FleetConfig{AgentID: s.data.Fleet.AgentID}
	return s.saveLocked()
}

func (s *ConfigStore) updateFleetChannel(updateChannel string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.data.Fleet.CloudBaseURL == "" || s.data.Fleet.DeviceToken == "" {
		return fmt.Errorf("not enrolled")
	}
	s.data.Fleet.UpdateChannel = updateChannel
	return s.saveLocked()
}

func (s *ConfigStore) saveLocked() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(s.data, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, raw, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
func randomHex(size int) string {
	data := make([]byte, size)
	_, _ = rand.Read(data)
	return hex.EncodeToString(data)
}
func randomDigits(size int) string {
	data := make([]byte, size)
	_, _ = rand.Read(data)
	out := make([]byte, size)
	for i, value := range data {
		out[i] = '0' + value%10
	}
	return string(out)
}

func containsOrigin(origins []string, target string) bool {
	for _, o := range origins {
		if o == target {
			return true
		}
	}
	return false
}
