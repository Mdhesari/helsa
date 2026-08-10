package api

import (
	"net/http"
	"time"
)

// dayRangeParams parses the shared list-endpoint date query: whole local
// days, inclusive. `date` wins if both forms are given; a range requires both
// `from` and `to`; default is today. Returns ok=false after writing a 400.
func (s *Server) dayRangeParams(w http.ResponseWriter, r *http.Request, loc *time.Location) (start, end time.Time, ok bool) {
	q := r.URL.Query()
	parseDay := func(v string) (time.Time, error) {
		return time.ParseInLocation("2006-01-02", v, loc)
	}
	switch {
	case q.Get("date") != "":
		d, err := parseDay(q.Get("date"))
		if err != nil {
			badRequest(w, "date must be YYYY-MM-DD")
			return time.Time{}, time.Time{}, false
		}
		return d, d, true
	case q.Get("from") != "" || q.Get("to") != "":
		if q.Get("from") == "" || q.Get("to") == "" {
			badRequest(w, "both from and to are required for a range")
			return time.Time{}, time.Time{}, false
		}
		from, err1 := parseDay(q.Get("from"))
		to, err2 := parseDay(q.Get("to"))
		if err1 != nil || err2 != nil {
			badRequest(w, "from and to must be YYYY-MM-DD")
			return time.Time{}, time.Time{}, false
		}
		if to.Before(from) {
			badRequest(w, "to must not be before from")
			return time.Time{}, time.Time{}, false
		}
		return from, to, true
	default:
		now := s.now().In(loc)
		d := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
		return d, d, true
	}
}

// fromToParams parses an optional from/to pair of whole local days. A missing
// `to` defaults to today; a missing `from` defaults to defaultDays-1 days
// before `to` (i.e. the "last N local days" window from the contract).
// Returns ok=false after writing a 400.
func (s *Server) fromToParams(w http.ResponseWriter, r *http.Request, loc *time.Location, defaultDays int) (start, end time.Time, ok bool) {
	q := r.URL.Query()
	parseDay := func(v string) (time.Time, error) {
		return time.ParseInLocation("2006-01-02", v, loc)
	}
	if v := q.Get("to"); v != "" {
		d, err := parseDay(v)
		if err != nil {
			badRequest(w, "to must be YYYY-MM-DD")
			return time.Time{}, time.Time{}, false
		}
		end = d
	} else {
		now := s.now().In(loc)
		end = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	}
	if v := q.Get("from"); v != "" {
		d, err := parseDay(v)
		if err != nil {
			badRequest(w, "from must be YYYY-MM-DD")
			return time.Time{}, time.Time{}, false
		}
		start = d
	} else {
		start = end.AddDate(0, 0, -(defaultDays - 1))
	}
	if end.Before(start) {
		badRequest(w, "to must not be before from")
		return time.Time{}, time.Time{}, false
	}
	return start, end, true
}
