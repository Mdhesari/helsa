package api

import (
	"database/sql"
	"net/http"
	"strings"
)

// Client-supplied idempotency keys for offline replay.
//
// The PWA queues writes made without a connection and retries them. A retry may
// follow a request that reached the server but whose response was lost, so the
// "create" endpoints that back offline logging accept a client_key and treat
// (user_id, client_key) as unique. Replaying a key returns the row it already
// created (200) instead of inserting a duplicate.
//
// Only endpoints where a duplicate would silently corrupt a total need this:
// food logs, workouts, weights and habit logs. The diary is a PUT upsert keyed
// on (user, date) and is therefore already idempotent.

// maxClientKeyLen bounds the key. The client sends a UUID (36 chars); anything
// longer is a caller bug or an abuse attempt.
const maxClientKeyLen = 64

// parseClientKey validates an optional client_key. Returns ok=false when the
// response has already been written.
func parseClientKey(w http.ResponseWriter, raw *string) (sql.NullString, bool) {
	if raw == nil {
		return sql.NullString{}, true
	}
	key := strings.TrimSpace(*raw)
	if key == "" || len(key) > maxClientKeyLen {
		badRequest(w, "client_key must be 1-64 characters")
		return sql.NullString{}, false
	}
	return sql.NullString{String: key, Valid: true}, true
}

// rejectClientKeyOnUpdate 400s when a client_key is sent to a PUT. The key
// identifies the originating offline write; letting an update move it would
// break replay dedup for whichever row currently holds it.
func rejectClientKeyOnUpdate(w http.ResponseWriter, raw *string) bool {
	if raw != nil {
		badRequest(w, "client_key cannot be changed")
		return false
	}
	return true
}
