package agent

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
)

func SetupLogging(directory string) (func() error, error) {
	if err := os.MkdirAll(directory, 0o700); err != nil {
		return nil, err
	}
	path := filepath.Join(directory, "agent.log")
	if info, err := os.Stat(path); err == nil && info.Size() > 5<<20 {
		_ = os.Remove(path + ".2")
		_ = os.Rename(path+".1", path+".2")
		_ = os.Rename(path, path+".1")
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err != nil {
		return nil, fmt.Errorf("open log: %w", err)
	}
	log.SetOutput(io.MultiWriter(os.Stderr, file))
	log.SetFlags(log.Ldate | log.Ltime | log.LUTC)
	return file.Close, nil
}
