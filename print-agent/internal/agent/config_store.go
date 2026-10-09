package agent

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

type FleetConfig struct {
	AgentID       string `json:"agentId,omitempty"`
	DisplayName   string `json:"displayName,omitempty"`
	CloudBaseURL  string `json:"cloudBaseURL,omitempty"`
	DeviceToken   string `json:"deviceToken,omitempty"`
	UpdateChannel string `json:"updateChannel,omitempty"`
}

// ClientConfig is one paired browser client. Pairing is multi-client: every
// browser/profile/device that pairs gets its own token, and pairing a new
// client must not invalidate the existing ones.
type ClientConfig struct {
	TokenHash string `json:"tokenHash"`
	Origin    string `json:"origin,omitempty"`
	PairedAt  string `json:"pairedAt,omitempty"`
}

type PersistentConfig struct {
	// Legacy single-client fields — still written as "most recent pairing" so
	// an older binary reading this file keeps working (downgrade safety), and
	// migrated into Clients on first load.
	TokenHash      string                  `json:"tokenHash,omitempty"`
	ClientID       string                  `json:"clientId,omitempty"`
	Clients        map[string]ClientConfig `json:"clients,omitempty"`
	AllowedOrigins []string                `json:"allowedOrigins,omitempty"`
	PairingCode    string                  `json:"pairingCode"`
	Fleet          FleetConfig             `json:"fleet,omitempty"`
}

// Cap on stored clients so a busy workstation cannot grow the file forever.
const maxPairedClients = 32

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
	if store.data.Clients == nil {
		store.data.Clients = map[string]ClientConfig{}
	}
	// Migrate a legacy single pairing into the clients map.
	if store.data.TokenHash != "" && store.data.ClientID != "" {
		if _, ok := store.data.Clients[store.data.ClientID]; !ok {
			store.data.Clients[store.data.ClientID] = ClientConfig{TokenHash: store.data.TokenHash, PairedAt: time.Now().UTC().Format(time.RFC3339)}
		}
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
	return len(s.data.Clients) > 0 || s.data.TokenHash != ""
}
func (s *ConfigStore) Origins() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.data.AllowedOrigins...)
}

// Pairing reports the most recently paired client for display purposes
// (e.g. the Print Agent page's "Connected" summary). Use Pairings() for the
// full list.
func (s *ConfigStore) Pairing() (string, string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	clients := s.sortedClientsLocked()
	if len(clients) == 0 {
		return "", "", false
	}
	latest := clients[len(clients)-1]
	return latest.id, latest.cfg.Origin, true
}

// Pairings returns every paired client, most recent last.
func (s *ConfigStore) Pairings() []ClientConfig {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]ClientConfig, 0, len(s.data.Clients))
	for _, c := range s.sortedClientsLocked() {
		out = append(out, c.cfg)
	}
	return out
}

type clientEntry struct {
	id  string
	cfg ClientConfig
}

func (s *ConfigStore) sortedClientsLocked() []clientEntry {
	entries := make([]clientEntry, 0, len(s.data.Clients))
	for id, cfg := range s.data.Clients {
		entries = append(entries, clientEntry{id: id, cfg: cfg})
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].cfg.PairedAt < entries[j].cfg.PairedAt })
	return entries
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
	if s.data.Clients == nil {
		s.data.Clients = map[string]ClientConfig{}
	}
	s.data.Clients[clientID] = ClientConfig{
		TokenHash: hashToken(token),
		Origin:    origin,
		PairedAt:  time.Now().UTC().Format(time.RFC3339),
	}
	s.evictOldestClientsLocked()
	// Mirror the most recent client into the legacy fields so an older binary
	// reading this file still validates a token (downgrade safety).
	s.data.TokenHash = hashToken(token)
	s.data.ClientID = clientID
	// Additive, not a replace: pairing from a new origin (e.g. re-pairing
	// from a local dev URL after already being paired with the production
	// site) must not wipe previously-trusted origins. A device is commonly
	// used from more than one page (production + local dev, or two staff
	// workstations sharing one agent), so trust accumulates unless the
	// person explicitly unpairs.
	if !containsOrigin(s.data.AllowedOrigins, origin) {
		s.data.AllowedOrigins = append(s.data.AllowedOrigins, origin)
	}
	s.pairingCode = randomDigits(6)
	s.data.PairingCode = s.pairingCode
	return token, s.saveLocked()
}

// UnpairByToken removes only the client that owns the given token —
// disconnecting one browser must not sign every other client out.
func (s *ConfigStore) UnpairByToken(token string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, cfg := range s.data.Clients {
		if subtle.ConstantTimeCompare([]byte(cfg.TokenHash), []byte(hashToken(token))) == 1 {
			delete(s.data.Clients, id)
			s.refreshLegacyLocked()
			return s.saveLocked()
		}
	}
	// Legacy-only pairing (pre-migration file): clear it.
	if s.data.TokenHash != "" && subtle.ConstantTimeCompare([]byte(s.data.TokenHash), []byte(hashToken(token))) == 1 {
		s.data.TokenHash, s.data.ClientID = "", ""
		s.pairingCode = randomDigits(6)
		s.data.PairingCode = s.pairingCode
		return s.saveLocked()
	}
	return fmt.Errorf("pairing not found")
}

// Unpair wipes ALL clients — used by explicit "remove every pairing" flows.
func (s *ConfigStore) Unpair() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data.Clients = map[string]ClientConfig{}
	s.data.TokenHash, s.data.ClientID = "", ""
	s.pairingCode = randomDigits(6)
	s.data.PairingCode = s.pairingCode
	return s.saveLocked()
}

func (s *ConfigStore) Verify(token string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if token == "" {
		return false
	}
	hashed := hashToken(token)
	for _, cfg := range s.data.Clients {
		if subtle.ConstantTimeCompare([]byte(cfg.TokenHash), []byte(hashed)) == 1 {
			return true
		}
	}
	return s.data.TokenHash != "" && subtle.ConstantTimeCompare([]byte(s.data.TokenHash), []byte(hashed)) == 1
}

// refreshLegacyLocked keeps the legacy single-client fields pointing at the
// most recently paired client (or clears them when no clients remain).
func (s *ConfigStore) refreshLegacyLocked() {
	clients := s.sortedClientsLocked()
	if len(clients) == 0 {
		s.data.TokenHash, s.data.ClientID = "", ""
		return
	}
	latest := clients[len(clients)-1]
	s.data.TokenHash = latest.cfg.TokenHash
	s.data.ClientID = latest.id
}

// evictOldestClientsLocked drops oldest pairings past the cap.
func (s *ConfigStore) evictOldestClientsLocked() {
	for len(s.data.Clients) > maxPairedClients {
		clients := s.sortedClientsLocked()
		delete(s.data.Clients, clients[0].id)
	}
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
