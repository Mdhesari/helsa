// Package reports contains pure, timezone-aware aggregation over tracked
// data: period boundaries, per-local-day bucketing of food logs and workouts,
// weight and habit series, averages, deltas and any-kind streaks.
package reports

import (
	"fmt"
	"math"
	"sort"
	"time"

	"helsa/backend/internal/nutrition"
)

// Totals is a sum (or average) of nutrients.
type Totals struct {
	Calories float64 `json:"calories"`
	ProteinG float64 `json:"protein_g"`
	CarbsG   float64 `json:"carbs_g"`
	FatG     float64 `json:"fat_g"`
}

// Bucket is one local day inside a report period.
type Bucket struct {
	Date           string  `json:"date"` // YYYY-MM-DD in the user's timezone
	Totals         Totals  `json:"totals"`
	LogCount       int     `json:"log_count"`
	BurnedCalories float64 `json:"burned_calories"`
	WorkoutCount   int     `json:"workout_count"`
}

// WeightPoint is the last weight entry of one local day.
type WeightPoint struct {
	Date     string  `json:"date"`
	WeightKg float64 `json:"weight_kg"`
}

// HabitInfo is the Habit shape embedded in a report habit series.
type HabitInfo struct {
	ID          int64  `json:"id"`
	Kind        string `json:"kind"`
	Name        string `json:"name"`
	Unit        string `json:"unit"`
	Direction   string `json:"direction"`
	DailyTarget *int64 `json:"daily_target"`
	Archived    bool   `json:"archived"`
	CreatedAt   string `json:"created_at"`
}

// CountPoint is a habit's summed count on one local day.
type CountPoint struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

// HabitSeries is one habit's zero-filled per-day count series over a period.
type HabitSeries struct {
	Habit  HabitInfo    `json:"habit"`
	Series []CountPoint `json:"series"`
}

// Deltas are (average − target) / target × 100 per nutrient, rounded to one
// decimal. Negative = deficiency, positive = excess.
type Deltas struct {
	CaloriesPct float64 `json:"calories_pct"`
	ProteinPct  float64 `json:"protein_pct"`
	CarbsPct    float64 `json:"carbs_pct"`
	FatPct      float64 `json:"fat_pct"`
}

// Streak describes any-kind tracking streaks in local days.
type Streak struct {
	CurrentDays int `json:"current_days"`
	LongestDays int `json:"longest_days"`
}

// LogRow is the minimal projection of a food log needed for aggregation.
type LogRow struct {
	LoggedAt int64 // unix seconds, UTC
	Calories float64
	ProteinG float64
	CarbsG   float64
	FatG     float64
}

// WorkoutRow is the minimal projection of a workout needed for aggregation.
type WorkoutRow struct {
	LoggedAt int64 // unix seconds, UTC
	Calories float64
}

// Stats bundles everything a report (and the AI insight prompt) needs.
type Stats struct {
	Period    string
	StartDate string
	EndDate   string
	Timezone  string
	Plan      nutrition.Plan
	Buckets   []Bucket
	Weights   []WeightPoint
	Habits    []HabitSeries
	Averages  *Totals
	Deltas    *Deltas
	Streak    Streak
}

// Bounds computes the inclusive local-day boundaries of a report period
// containing ref (any instant; its local date in loc is used).
// daily = that local day; weekly = Monday–Sunday; monthly = calendar month.
// The returned times are local midnights in loc, so start.Unix() and
// end.AddDate(0,0,1).Unix() form the UTC unix half-open query range.
func Bounds(period string, ref time.Time, loc *time.Location) (start, end time.Time, err error) {
	local := ref.In(loc)
	day := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc)
	switch period {
	case "daily":
		return day, day, nil
	case "weekly":
		wd := int(day.Weekday())
		if wd == 0 { // Sunday
			wd = 7
		}
		start = day.AddDate(0, 0, -(wd - 1)) // Monday
		return start, start.AddDate(0, 0, 6), nil
	case "monthly":
		start = time.Date(day.Year(), day.Month(), 1, 0, 0, 0, 0, loc)
		return start, start.AddDate(0, 1, -1), nil
	}
	return time.Time{}, time.Time{}, fmt.Errorf("invalid period %q", period)
}

// DayRange lists every local date key from start to end (inclusive local
// midnights in loc) as YYYY-MM-DD strings.
func DayRange(start, end time.Time) []string {
	var days []string
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		days = append(days, d.Format("2006-01-02"))
	}
	return days
}

// BucketByDay groups food logs and workouts into one bucket per local day
// from start to end (inclusive local midnights in loc), with zeros for empty
// days. Rows outside the range are ignored.
func BucketByDay(logs []LogRow, workouts []WorkoutRow, start, end time.Time, loc *time.Location) []Bucket {
	var buckets []Bucket
	index := make(map[string]int)
	for _, key := range DayRange(start, end) {
		index[key] = len(buckets)
		buckets = append(buckets, Bucket{Date: key})
	}
	dayKey := func(unix int64) string {
		return time.Unix(unix, 0).In(loc).Format("2006-01-02")
	}
	for _, r := range logs {
		i, ok := index[dayKey(r.LoggedAt)]
		if !ok {
			continue
		}
		b := &buckets[i]
		b.Totals.Calories += r.Calories
		b.Totals.ProteinG += r.ProteinG
		b.Totals.CarbsG += r.CarbsG
		b.Totals.FatG += r.FatG
		b.LogCount++
	}
	for _, w := range workouts {
		i, ok := index[dayKey(w.LoggedAt)]
		if !ok {
			continue
		}
		b := &buckets[i]
		b.BurnedCalories += w.Calories
		b.WorkoutCount++
	}
	return buckets
}

// Averages computes the mean totals over days that have at least one food
// log. ok is false when no day in the period has a log.
func Averages(buckets []Bucket) (Totals, bool) {
	var sum Totals
	days := 0
	for _, b := range buckets {
		if b.LogCount == 0 {
			continue
		}
		days++
		sum.Calories += b.Totals.Calories
		sum.ProteinG += b.Totals.ProteinG
		sum.CarbsG += b.Totals.CarbsG
		sum.FatG += b.Totals.FatG
	}
	if days == 0 {
		return Totals{}, false
	}
	n := float64(days)
	return Totals{
		Calories: round1(sum.Calories / n),
		ProteinG: round1(sum.ProteinG / n),
		CarbsG:   round1(sum.CarbsG / n),
		FatG:     round1(sum.FatG / n),
	}, true
}

// ComputeDeltas returns (avg − target) / target × 100 per nutrient, one
// decimal. A zero target yields a zero delta for that nutrient.
func ComputeDeltas(avg, target Totals) Deltas {
	return Deltas{
		CaloriesPct: pctDelta(avg.Calories, target.Calories),
		ProteinPct:  pctDelta(avg.ProteinG, target.ProteinG),
		CarbsPct:    pctDelta(avg.CarbsG, target.CarbsG),
		FatPct:      pctDelta(avg.FatG, target.FatG),
	}
}

// DayIndex converts an instant to a monotonically increasing local-day index
// (days since the epoch of its calendar date in loc). Safe for streak math
// across timezones and DST.
func DayIndex(t time.Time, loc *time.Location) int64 {
	l := t.In(loc)
	return time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, time.UTC).Unix() / 86400
}

// DateIndex converts a YYYY-MM-DD local-date string (e.g. a diary entry key)
// to the same day index space as DayIndex. ok is false for malformed dates.
func DateIndex(date string) (int64, bool) {
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return 0, false
	}
	return t.Unix() / 86400, true
}

// ComputeStreak computes the current and longest tracking streaks.
// days are local-day indexes (see DayIndex) of every tracked item of any
// kind — food log, workout, habit log or diary entry (duplicates fine);
// today is the caller's current local-day index. The current streak counts
// consecutive days ending today or yesterday — an untracked "today" does not
// break it until the day is over.
func ComputeStreak(days []int64, today int64) Streak {
	if len(days) == 0 {
		return Streak{}
	}
	set := make(map[int64]bool, len(days))
	for _, d := range days {
		set[d] = true
	}
	distinct := make([]int64, 0, len(set))
	for d := range set {
		distinct = append(distinct, d)
	}
	sort.Slice(distinct, func(i, j int) bool { return distinct[i] < distinct[j] })

	longest, run := 1, 1
	for i := 1; i < len(distinct); i++ {
		if distinct[i] == distinct[i-1]+1 {
			run++
		} else {
			run = 1
		}
		if run > longest {
			longest = run
		}
	}

	current := 0
	anchor := today
	if !set[anchor] {
		anchor = today - 1
	}
	for set[anchor] {
		current++
		anchor--
	}
	return Streak{CurrentDays: current, LongestDays: longest}
}

func pctDelta(avg, target float64) float64 {
	if target == 0 {
		return 0
	}
	return round1((avg - target) / target * 100)
}

func round1(x float64) float64 {
	return math.Round(x*10) / 10
}
