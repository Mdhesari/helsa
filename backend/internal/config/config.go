// Package config loads server configuration from the environment.
package config

import (
	"log"
	"os"
)

// DevJWTSecret is the insecure fallback used when JWT_SECRET is unset.
const DevJWTSecret = "helsa-dev-secret-do-not-use-in-prod"

// Config holds all runtime configuration for the server.
type Config struct {
	Port             string
	DBPath           string
	JWTSecret        string
	OpenRouterAPIKey string
	AIModel          string
}

// Load reads configuration from the environment, applying documented defaults.
// It logs a loud warning when the dev JWT secret fallback is in use.
func Load() Config {
	cfg := Config{
		Port:             getenv("PORT", "8080"),
		DBPath:           getenv("DB_PATH", "./helsa.db"),
		JWTSecret:        os.Getenv("JWT_SECRET"),
		OpenRouterAPIKey: os.Getenv("OPENROUTER_API_KEY"),
		AIModel:          getenv("AI_MODEL", "anthropic/claude-sonnet-5"),
	}
	if cfg.JWTSecret == "" {
		cfg.JWTSecret = DevJWTSecret
		log.Println("WARNING: JWT_SECRET is not set; using an INSECURE development fallback. Set JWT_SECRET in production.")
	}
	return cfg
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
