package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"helsa/backend/internal/auth"
)

const maxBodyBytes = 1 << 20 // 1 MiB

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": message}})
}

func badRequest(w http.ResponseWriter, message string) {
	writeError(w, http.StatusBadRequest, "invalid_request", message)
}

func internalError(w http.ResponseWriter, err error) {
	// Do not leak internals to the client.
	_ = err
	writeError(w, http.StatusInternalServerError, "internal", "internal error")
}

// decodeBody decodes a JSON request body into v with a size cap.
func decodeBody(r *http.Request, v any) error {
	dec := json.NewDecoder(io.LimitReader(r.Body, maxBodyBytes))
	if err := dec.Decode(v); err != nil {
		return errors.New("malformed JSON body")
	}
	return nil
}

// rfc3339 renders unix seconds as an RFC3339 UTC string.
func rfc3339(unix int64) string {
	return time.Unix(unix, 0).UTC().Format(time.RFC3339)
}

// userLocation resolves the user's IANA timezone, falling back to UTC.
func userLocation(u auth.User) *time.Location {
	loc, err := time.LoadLocation(u.Timezone)
	if err != nil {
		return time.UTC
	}
	return loc
}
