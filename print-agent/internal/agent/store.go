package agent

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"
)

type JobRecord struct {
	Job       Job       `json:"job"`
	Status    JobStatus `json:"status"`
	Attempts  int       `json:"attempts"`
	Cancelled bool      `json:"cancelled"`
}

type JobStats struct {
	Total      int `json:"total"`
	Queued     int `json:"queued"`
	Processing int `json:"processing"`
	Completed  int `json:"completed"`
	Failed     int `json:"failed"`
	Cancelled  int `json:"cancelled"`
}

type JobStore struct {
	mu      sync.Mutex
	path    string
	records map[string]JobRecord
}

func NewJobStore(path string) (*JobStore, error) {
	store := &JobStore{path: path, records: map[string]JobRecord{}}
	if err := store.load(); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *JobStore) Put(record JobRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.records[record.Job.ID] = record
	return s.saveLocked()
}

func (s *JobStore) Get(id string) (JobRecord, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	record, ok := s.records[id]
	return record, ok
}

func (s *JobStore) List(state, clientID string, limit int) []JobRecord {
	s.mu.Lock()
	defer s.mu.Unlock()
	ids := make([]string, 0, len(s.records))
	for id := range s.records {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	out := make([]JobRecord, 0, len(s.records))
	for _, id := range ids {
		record := s.records[id]
		if state != "" && record.Status.State != state {
			continue
		}
		if clientID != "" && record.Job.ClientID != clientID {
			continue
		}
		out = append(out, record)
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	return out
}

func (s *JobStore) LastFailedError() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	var latest time.Time
	var last string
	for _, record := range s.records {
		if record.Status.State == "failed" && record.Status.Error != "" && record.Status.UpdatedAt.After(latest) {
			latest = record.Status.UpdatedAt
			last = record.Status.Error
		}
	}
	return last
}

func (s *JobStore) Stats() JobStats {
	s.mu.Lock()
	defer s.mu.Unlock()
	var st JobStats
	for _, record := range s.records {
		st.Total++
		switch record.Status.State {
		case "queued":
			st.Queued++
		case "processing":
			st.Processing++
		case "completed":
			st.Completed++
		case "failed":
			st.Failed++
		case "cancelled":
			st.Cancelled++
		}
	}
	return st
}

func (s *JobStore) ListRecoverable() []JobRecord {
	s.mu.Lock()
	defer s.mu.Unlock()
	var records []JobRecord
	for id, record := range s.records {
		if record.Status.State == "queued" || record.Status.State == "processing" {
			record.Status.State = "queued"
			record.Status.UpdatedAt = time.Now().UTC()
			s.records[id] = record
			records = append(records, record)
		}
	}
	_ = s.saveLocked()
	return records
}

func (s *JobStore) Purge(before time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, record := range s.records {
		if (record.Status.State == "completed" || record.Status.State == "failed" || record.Status.State == "cancelled") && record.Status.UpdatedAt.Before(before) {
			delete(s.records, id)
		}
	}
	return s.saveLocked()
}

func (s *JobStore) Cancel(id string) (JobRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	record, ok := s.records[id]
	if !ok {
		return JobRecord{}, os.ErrNotExist
	}
	if record.Status.State == "completed" || record.Status.State == "failed" {
		return record, errors.New("job is already finished")
	}
	record.Cancelled = true
	record.Status.State = "cancelled"
	record.Status.UpdatedAt = time.Now().UTC()
	s.records[id] = record
	return record, s.saveLocked()
}

func (s *JobStore) Retry(id string) (JobRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	record, ok := s.records[id]
	if !ok {
		return JobRecord{}, os.ErrNotExist
	}
	if record.Status.State != "failed" && record.Status.State != "cancelled" {
		return record, errors.New("job cannot be retried")
	}
	record.Status.State = "queued"
	record.Status.Error = ""
	record.Status.UpdatedAt = time.Now().UTC()
	record.Attempts = 0
	record.Cancelled = false
	s.records[id] = record
	return record, s.saveLocked()
}

func (s *JobStore) load() error {
	data, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	if len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, &s.records)
}

func (s *JobStore) saveLocked() error {
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s.records, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}
