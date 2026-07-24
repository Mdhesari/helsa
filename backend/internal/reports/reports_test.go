package reports

import (
	"testing"
	"time"
)

func tehran(t *testing.T) *time.Location {
	t.Helper()
	loc, err := time.LoadLocation("Asia/Tehran")
	if err != nil {
		t.Fatalf("load Asia/Tehran: %v", err)
	}
	return loc
}

func TestComputeStreak(t *testing.T) {
	const today int64 = 20000
	tests := []struct {
		name    string
		days    []int64
		current int
		longest int
	}{
		{"empty", nil, 0, 0},
		{"only today", []int64{today}, 1, 1},
		{"run ending today", []int64{today - 2, today - 1, today}, 3, 3},
		{"today untracked, yesterday tracked keeps streak", []int64{today - 3, today - 2, today - 1}, 3, 3},
		{"gap two days ago breaks current", []int64{today - 5, today - 4, today - 3}, 0, 3},
		{"gap inside history", []int64{today - 6, today - 5, today - 3, today - 1, today}, 2, 2},
		{"longest exceeds current", []int64{today - 9, today - 8, today - 7, today - 6, today - 3, today}, 1, 4},
		{"duplicates collapse", []int64{today, today, today - 1, today - 1}, 2, 2},
		// Any-kind semantics: the caller mixes day indexes from food logs,
		// workouts, habit logs and diary entries into one slice — mixed
		// sources on adjacent days must chain into one streak.
		{"mixed sources chain", []int64{today - 2, today - 1, today}, 3, 3},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ComputeStreak(tt.days, today)
			if got.CurrentDays != tt.current || got.LongestDays != tt.longest {
				t.Fatalf("ComputeStreak() = %+v, want current %d longest %d", got, tt.current, tt.longest)
			}
		})
	}
}

func TestDateIndexMatchesDayIndex(t *testing.T) {
	loc := tehran(t)
	// A late-night local instant and its local date string must map to the
	// same index.
	instant := time.Date(2026, 7, 2, 23, 30, 0, 0, loc)
	di := DayIndex(instant, loc)
	si, ok := DateIndex("2026-07-02")
	if !ok || si != di {
		t.Fatalf("DateIndex(2026-07-02) = %d, %v; want %d", si, ok, di)
	}
	if _, ok := DateIndex("garbage"); ok {
		t.Fatal("DateIndex(garbage) should not be ok")
	}
}

func TestBoundsWeeklyMonSun(t *testing.T) {
	loc := tehran(t)
	tests := []struct {
		name       string
		ref        time.Time
		start, end string
	}{
		{"thursday mid-week", time.Date(2026, 7, 2, 12, 0, 0, 0, loc), "2026-06-29", "2026-07-05"},
		{"monday is start of week", time.Date(2026, 6, 29, 0, 0, 0, 0, loc), "2026-06-29", "2026-07-05"},
		{"sunday is end of week", time.Date(2026, 7, 5, 23, 59, 0, 0, loc), "2026-06-29", "2026-07-05"},
		{"next monday rolls over", time.Date(2026, 7, 6, 1, 0, 0, 0, loc), "2026-07-06", "2026-07-12"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			start, end, err := Bounds("weekly", tt.ref, loc)
			if err != nil {
				t.Fatal(err)
			}
			if got := start.Format("2006-01-02"); got != tt.start {
				t.Errorf("start = %s, want %s", got, tt.start)
			}
			if got := end.Format("2006-01-02"); got != tt.end {
				t.Errorf("end = %s, want %s", got, tt.end)
			}
		})
	}
}

func TestBoundsDailyAndMonthly(t *testing.T) {
	loc := tehran(t)
	start, end, err := Bounds("daily", time.Date(2026, 7, 2, 23, 45, 0, 0, loc), loc)
	if err != nil {
		t.Fatal(err)
	}
	if start.Format("2006-01-02") != "2026-07-02" || end.Format("2006-01-02") != "2026-07-02" {
		t.Fatalf("daily bounds = %s..%s, want 2026-07-02..2026-07-02", start.Format("2006-01-02"), end.Format("2006-01-02"))
	}

	start, end, err = Bounds("monthly", time.Date(2026, 2, 15, 12, 0, 0, 0, loc), loc)
	if err != nil {
		t.Fatal(err)
	}
	if start.Format("2006-01-02") != "2026-02-01" || end.Format("2006-01-02") != "2026-02-28" {
		t.Fatalf("monthly bounds = %s..%s, want 2026-02-01..2026-02-28", start.Format("2006-01-02"), end.Format("2006-01-02"))
	}

	if _, _, err := Bounds("hourly", time.Now(), loc); err == nil {
		t.Fatal("Bounds(hourly) should fail")
	}
}

func TestBucketByDayTimezone(t *testing.T) {
	loc := tehran(t)
	// 23:30 local on 2026-07-02 is 20:00 UTC — must land on the 07-02 LOCAL bucket.
	lateNight := time.Date(2026, 7, 2, 23, 30, 0, 0, loc)
	// 00:30 local on 2026-07-03 must land on 07-03, not 07-02.
	earlyNext := time.Date(2026, 7, 3, 0, 30, 0, 0, loc)
	logs := []LogRow{
		{LoggedAt: lateNight.Unix(), Calories: 500, ProteinG: 30, CarbsG: 50, FatG: 10},
		{LoggedAt: earlyNext.Unix(), Calories: 200},
	}
	workouts := []WorkoutRow{
		{LoggedAt: lateNight.Unix(), Calories: 420},
		{LoggedAt: earlyNext.Unix(), Calories: 100},
		{LoggedAt: earlyNext.Add(time.Hour).Unix(), Calories: 50},
	}

	start, end, err := Bounds("weekly", lateNight, loc)
	if err != nil {
		t.Fatal(err)
	}
	buckets := BucketByDay(logs, workouts, start, end, loc)
	if len(buckets) != 7 {
		t.Fatalf("got %d buckets, want 7", len(buckets))
	}
	byDate := map[string]Bucket{}
	for _, b := range buckets {
		byDate[b.Date] = b
	}
	if b := byDate["2026-07-02"]; b.LogCount != 1 || b.Totals.Calories != 500 || b.WorkoutCount != 1 || b.BurnedCalories != 420 {
		t.Errorf("2026-07-02 bucket = %+v, want 1 log / 500 kcal / 1 workout / 420 burned", b)
	}
	if b := byDate["2026-07-03"]; b.LogCount != 1 || b.Totals.Calories != 200 || b.WorkoutCount != 2 || b.BurnedCalories != 150 {
		t.Errorf("2026-07-03 bucket = %+v, want 1 log / 200 kcal / 2 workouts / 150 burned", b)
	}
	if b := byDate["2026-06-29"]; b.LogCount != 0 || b.WorkoutCount != 0 || b.Totals != (Totals{}) || b.BurnedCalories != 0 {
		t.Errorf("empty day bucket = %+v, want zeros", b)
	}
}

func TestDayRange(t *testing.T) {
	loc := tehran(t)
	start := time.Date(2026, 6, 29, 0, 0, 0, 0, loc)
	days := DayRange(start, start.AddDate(0, 0, 2))
	want := []string{"2026-06-29", "2026-06-30", "2026-07-01"}
	if len(days) != len(want) {
		t.Fatalf("DayRange len = %d, want %d", len(days), len(want))
	}
	for i := range want {
		if days[i] != want[i] {
			t.Errorf("DayRange[%d] = %s, want %s", i, days[i], want[i])
		}
	}
}

func TestAverages(t *testing.T) {
	buckets := []Bucket{
		{Date: "2026-07-01", Totals: Totals{Calories: 2000, ProteinG: 100, CarbsG: 200, FatG: 60}, LogCount: 3},
		// Empty food day excluded from the mean even though a workout exists.
		{Date: "2026-07-02", BurnedCalories: 300, WorkoutCount: 1},
		{Date: "2026-07-03", Totals: Totals{Calories: 1000, ProteinG: 51, CarbsG: 100, FatG: 30}, LogCount: 1},
	}
	avg, ok := Averages(buckets)
	if !ok {
		t.Fatal("Averages() ok = false, want true")
	}
	want := Totals{Calories: 1500, ProteinG: 75.5, CarbsG: 150, FatG: 45}
	if avg != want {
		t.Fatalf("Averages() = %+v, want %+v", avg, want)
	}

	if _, ok := Averages([]Bucket{{Date: "2026-07-01", BurnedCalories: 500, WorkoutCount: 2}}); ok {
		t.Fatal("Averages() over no food-logged days should be not-ok")
	}
}

func TestComputeDeltas(t *testing.T) {
	target := Totals{Calories: 2000, ProteinG: 150, CarbsG: 200, FatG: 67}
	avg := Totals{Calories: 1836, ProteinG: 118.5, CarbsG: 209, FatG: 75.2}
	got := ComputeDeltas(avg, target)
	want := Deltas{CaloriesPct: -8.2, ProteinPct: -21, CarbsPct: 4.5, FatPct: 12.2}
	if got != want {
		t.Fatalf("ComputeDeltas() = %+v, want %+v", got, want)
	}

	zero := ComputeDeltas(avg, Totals{})
	if zero != (Deltas{}) {
		t.Fatalf("zero targets should give zero deltas, got %+v", zero)
	}
}
