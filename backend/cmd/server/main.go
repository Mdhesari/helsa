// Command server runs the Helsa API server.
package main

import (
	"log"
	"net"
	"net/http"
	"time"

	"helsa/backend/internal/api"
	"helsa/backend/internal/config"
	"helsa/backend/internal/db"
	"helsa/backend/internal/insights"
)

func main() {
	cfg := config.Load()

	sqlDB, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("open database %s: %v", cfg.DBPath, err)
	}
	defer sqlDB.Close()

	var provider insights.Provider
	if cfg.OpenRouterAPIKey != "" {
		provider = insights.NewOpenRouterProvider(cfg.OpenRouterAPIKey, cfg.AIModel)
		log.Printf("insights: using openrouter provider (model %s)", cfg.AIModel)
	} else {
		provider = insights.StubProvider{}
		log.Println("insights: OPENROUTER_API_KEY not set, using stub provider")
	}

	srv := &http.Server{
		Addr:              net.JoinHostPort("", cfg.Port),
		Handler:           api.New(sqlDB, cfg.JWTSecret, provider).Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      60 * time.Second, // insight generation may take a few seconds
		IdleTimeout:       120 * time.Second,
	}

	log.Printf("helsa api listening on :%s (db %s)", cfg.Port, cfg.DBPath)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server: %v", err)
	}
}
