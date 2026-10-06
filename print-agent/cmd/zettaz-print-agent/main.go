package main

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/zettaz/print-agent/internal/agent"
	"github.com/zettaz/print-agent/internal/platform"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "service" {
		if err := platform.Run(os.Args[2:]); err != nil {
			log.Fatalf("service command failed: %v", err)
		}
		return
	}
	configRoot, err := os.UserConfigDir()
	if err != nil { log.Fatal(err) }
	configRoot = filepath.Join(configRoot, "Zettaz", "PrintAgent")
	closeLog, err := agent.SetupLogging(configRoot)
	if err != nil { log.Fatal(err) }
	defer closeLog()
	config := agent.Config{
		Address:        env("ZETTAZ_AGENT_LISTEN", "127.0.0.1:9419"),
		Token:          strings.TrimSpace(os.Getenv("ZETTAZ_AGENT_TOKEN")),
		AllowedOrigins: split(env("ZETTAZ_AGENT_ALLOWED_ORIGINS", "http://localhost:5173,https://cloud.zettaz.com")),
		ConfigPath:     filepath.Join(configRoot, "config.json"),
		JobStorePath:   filepath.Join(configRoot, "jobs.json"),
	}
	server := agent.New(config)
	if !platform.IsInteractive() {
		if err := platform.RunManaged(server.ListenAndServe, server.Shutdown); err != nil { log.Fatal(err) }
		return
	}
	if err := server.ListenAndServe(); err != nil { log.Fatal(err) }
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" { return value }
	return fallback
}

func split(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts { if item := strings.TrimSpace(part); item != "" { out = append(out, item) } }
	return out
}
