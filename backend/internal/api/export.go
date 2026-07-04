package api

import (
	"bytes"
	"net/http"
	"strconv"

	"helsa/backend/internal/auth"
	"helsa/backend/internal/export"
)

func (s *Server) handleExport(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromContext(r.Context())
	loc := userLocation(u)

	rows, err := s.db.QueryContext(r.Context(),
		`SELECT logged_at, food_name, serving, calories, protein_g, carbs_g, fat_g
		 FROM food_logs WHERE user_id = ? ORDER BY logged_at ASC, id ASC`, u.ID)
	if err != nil {
		internalError(w, err)
		return
	}
	defer rows.Close()

	var out []export.Row
	for rows.Next() {
		var row export.Row
		if err := rows.Scan(&row.LoggedAt, &row.FoodName, &row.Serving, &row.Calories, &row.ProteinG, &row.CarbsG, &row.FatG); err != nil {
			internalError(w, err)
			return
		}
		out = append(out, row)
	}
	if err := rows.Err(); err != nil {
		internalError(w, err)
		return
	}

	// Build into memory first so failures can still return a JSON error.
	var buf bytes.Buffer
	if err := export.WriteXLSX(&buf, out, loc); err != nil {
		internalError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	w.Header().Set("Content-Disposition", `attachment; filename="helsa-food-logs.xlsx"`)
	w.Header().Set("Content-Length", strconv.Itoa(buf.Len()))
	w.WriteHeader(http.StatusOK)
	_, _ = buf.WriteTo(w)
}
