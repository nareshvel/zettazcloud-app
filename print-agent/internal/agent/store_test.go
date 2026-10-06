package agent

import (
	"path/filepath"
	"testing"
	"time"
)

func TestJobStorePersistsAndRecovers(t *testing.T) {
	path := filepath.Join(t.TempDir(), "jobs.json")
	store, err := NewJobStore(path)
	if err != nil {
		t.Fatal(err)
	}
	record := JobRecord{Job: Job{ID: "job-1", ClientID: "test"}, Status: JobStatus{ID: "job-1", State: "processing", UpdatedAt: time.Now()}}
	if err := store.Put(record); err != nil {
		t.Fatal(err)
	}
	reloaded, err := NewJobStore(path)
	if err != nil {
		t.Fatal(err)
	}
	recoverable := reloaded.ListRecoverable()
	if len(recoverable) != 1 || recoverable[0].Status.State != "queued" {
		t.Fatalf("unexpected recovery: %#v", recoverable)
	}
}

func TestJobStoreCancel(t *testing.T) {
	store, err := NewJobStore(filepath.Join(t.TempDir(), "jobs.json"))
	if err != nil {
		t.Fatal(err)
	}
	record := JobRecord{Job: Job{ID: "job-2"}, Status: JobStatus{ID: "job-2", State: "queued", UpdatedAt: time.Now()}}
	if err := store.Put(record); err != nil {
		t.Fatal(err)
	}
	cancelled, err := store.Cancel("job-2")
	if err != nil {
		t.Fatal(err)
	}
	if cancelled.Status.State != "cancelled" || !cancelled.Cancelled {
		t.Fatalf("unexpected cancellation: %#v", cancelled)
	}
}

func TestJobStoreListDeterministicAndFiltered(t *testing.T) {
	store, err := NewJobStore(filepath.Join(t.TempDir(), "jobs.json"))
	if err != nil {
		t.Fatal(err)
	}
	records := []JobRecord{
		{Job: Job{ID: "job-2", ClientID: "x"}, Status: JobStatus{ID: "job-2", State: "failed", UpdatedAt: time.Now()}},
		{Job: Job{ID: "job-1", ClientID: "y"}, Status: JobStatus{ID: "job-1", State: "completed", UpdatedAt: time.Now()}},
		{Job: Job{ID: "job-3", ClientID: "x"}, Status: JobStatus{ID: "job-3", State: "queued", UpdatedAt: time.Now()}},
	}
	for _, rec := range records {
		if err := store.Put(rec); err != nil {
			t.Fatal(err)
		}
	}
	all := store.List("", "", 0)
	if len(all) != 3 || all[0].Job.ID != "job-1" || all[1].Job.ID != "job-2" || all[2].Job.ID != "job-3" {
		t.Fatalf("unexpected list: %#v", all)
	}
	x := store.List("", "x", 0)
	if len(x) != 2 || x[0].Job.ID != "job-2" {
		t.Fatalf("unexpected client filter: %#v", x)
	}
	failed := store.List("failed", "", 0)
	if len(failed) != 1 || failed[0].Job.ID != "job-2" {
		t.Fatalf("unexpected state filter: %#v", failed)
	}
	limited := store.List("", "", 1)
	if len(limited) != 1 || limited[0].Job.ID != "job-1" {
		t.Fatalf("unexpected limit: %#v", limited)
	}
}

func TestJobStoreStats(t *testing.T) {
	store, err := NewJobStore(filepath.Join(t.TempDir(), "jobs.json"))
	if err != nil {
		t.Fatal(err)
	}
	states := []string{"queued", "processing", "completed", "failed", "cancelled"}
	for i, state := range states {
		if err := store.Put(JobRecord{Job: Job{ID: "job-" + string(rune('a'+i))}, Status: JobStatus{ID: "job-" + string(rune('a'+i)), State: state, UpdatedAt: time.Now()}}); err != nil {
			t.Fatal(err)
		}
	}
	stats := store.Stats()
	if stats.Total != 5 || stats.Queued != 1 || stats.Processing != 1 || stats.Completed != 1 || stats.Failed != 1 || stats.Cancelled != 1 {
		t.Fatalf("unexpected stats: %#v", stats)
	}
}

func TestJobStoreRetry(t *testing.T) {
	store, err := NewJobStore(filepath.Join(t.TempDir(), "jobs.json"))
	if err != nil {
		t.Fatal(err)
	}
	failed := JobRecord{Job: Job{ID: "job-f"}, Status: JobStatus{ID: "job-f", State: "failed", Error: "boom", UpdatedAt: time.Now()}, Attempts: 2}
	if err := store.Put(failed); err != nil {
		t.Fatal(err)
	}
	retried, err := store.Retry("job-f")
	if err != nil {
		t.Fatal(err)
	}
	if retried.Status.State != "queued" || retried.Attempts != 0 || retried.Status.Error != "" {
		t.Fatalf("unexpected retry: %#v", retried)
	}
	queued := JobRecord{Job: Job{ID: "job-q"}, Status: JobStatus{ID: "job-q", State: "queued", UpdatedAt: time.Now()}}
	if err := store.Put(queued); err != nil {
		t.Fatal(err)
	}
	_, err = store.Retry("job-q")
	if err == nil {
		t.Fatal("expected retry to fail for queued job")
	}
}
