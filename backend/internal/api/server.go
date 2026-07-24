// Package api wires HTTP handlers for every endpoint in the Helsa contract.
package api

import (
	"database/sql"
	"net/http"
	"time"

	"helsa/backend/internal/auth"
	"helsa/backend/internal/insights"
)

// Server holds the wired dependencies for all handlers.
type Server struct {
	db        *sql.DB
	jwtSecret string
	provider  insights.Provider
	stub      insights.Provider
	now       func() time.Time
}

// New builds a Server. provider may be a remote provider; the stub is always
// kept as the fallback for provider outages.
func New(db *sql.DB, jwtSecret string, provider insights.Provider) *Server {
	return &Server{
		db:        db,
		jwtSecret: jwtSecret,
		provider:  provider,
		stub:      insights.StubProvider{},
		now:       time.Now,
	}
}

// Handler registers every route on a method-aware ServeMux and returns it.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	authed := auth.Middleware(s.jwtSecret, s.db)
	protect := func(h http.HandlerFunc) http.Handler { return authed(h) }

	mux.HandleFunc("GET /api/v1/health", s.handleHealth)
	mux.HandleFunc("POST /api/v1/auth/register", s.handleRegister)
	mux.HandleFunc("POST /api/v1/auth/login", s.handleLogin)

	mux.Handle("GET /api/v1/me", protect(s.handleGetMe))
	mux.Handle("PUT /api/v1/me", protect(s.handleUpdateMe))
	mux.Handle("PUT /api/v1/me/password", protect(s.handleChangePassword))
	mux.Handle("GET /api/v1/me/profile", protect(s.handleGetProfile))
	mux.Handle("PUT /api/v1/me/profile", protect(s.handleUpdateProfile))
	mux.Handle("GET /api/v1/me/plan", protect(s.handleGetPlan))

	mux.Handle("GET /api/v1/foods", protect(s.handleSearchFoods))
	mux.Handle("GET /api/v1/foods/suggestions", protect(s.handleFoodSuggestions))
	mux.Handle("GET /api/v1/foods/{id}", protect(s.handleGetFood))
	mux.Handle("POST /api/v1/foods", protect(s.handleCreateFood))
	mux.Handle("PUT /api/v1/foods/{id}/favorite", protect(s.handleAddFavorite))
	mux.Handle("DELETE /api/v1/foods/{id}/favorite", protect(s.handleRemoveFavorite))

	mux.Handle("POST /api/v1/logs", protect(s.handleCreateLog))
	mux.Handle("GET /api/v1/logs", protect(s.handleListLogs))
	mux.Handle("PUT /api/v1/logs/{id}", protect(s.handleUpdateLog))
	mux.Handle("DELETE /api/v1/logs/{id}", protect(s.handleDeleteLog))

	mux.Handle("POST /api/v1/workouts", protect(s.handleCreateWorkout))
	mux.Handle("GET /api/v1/workouts", protect(s.handleListWorkouts))
	mux.Handle("PUT /api/v1/workouts/{id}", protect(s.handleUpdateWorkout))
	mux.Handle("DELETE /api/v1/workouts/{id}", protect(s.handleDeleteWorkout))

	mux.Handle("POST /api/v1/weights", protect(s.handleCreateWeight))
	mux.Handle("GET /api/v1/weights", protect(s.handleListWeights))
	mux.Handle("DELETE /api/v1/weights/{id}", protect(s.handleDeleteWeight))

	mux.Handle("GET /api/v1/habits", protect(s.handleListHabits))
	mux.Handle("POST /api/v1/habits", protect(s.handleCreateHabit))
	mux.Handle("PUT /api/v1/habits/{id}", protect(s.handleUpdateHabit))
	mux.Handle("DELETE /api/v1/habits/{id}", protect(s.handleDeleteHabit))
	mux.Handle("POST /api/v1/habits/{id}/logs", protect(s.handleCreateHabitLog))
	mux.Handle("GET /api/v1/habits/{id}/logs", protect(s.handleListHabitLogs))
	mux.Handle("DELETE /api/v1/habits/{id}/logs/{logId}", protect(s.handleDeleteHabitLog))

	mux.Handle("GET /api/v1/diary", protect(s.handleGetDiary))
	mux.Handle("PUT /api/v1/diary/{date}", protect(s.handlePutDiary))
	mux.Handle("DELETE /api/v1/diary/{date}", protect(s.handleDeleteDiary))

	mux.Handle("GET /api/v1/dashboard", protect(s.handleDashboard))
	mux.Handle("GET /api/v1/reports", protect(s.handleReports))
	mux.Handle("GET /api/v1/reports/insight", protect(s.handleInsight))
	mux.Handle("GET /api/v1/export.xlsx", protect(s.handleExport))

	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
