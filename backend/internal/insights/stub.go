package insights

import (
	"context"
	"fmt"
	"math"
	"strings"
)

// StubProvider produces deterministic rule-based insights from the stats.
// It never fails, which also makes it the fallback for remote outages.
type StubProvider struct{}

// GenerateInsight implements Provider.
func (StubProvider) GenerateInsight(_ context.Context, stats ReportStats) (Insight, error) {
	var b strings.Builder

	loggedDays := 0
	totalLogs := 0
	workoutCount := 0
	var burned float64
	for _, bucket := range stats.Buckets {
		if bucket.LogCount > 0 {
			loggedDays++
		}
		totalLogs += bucket.LogCount
		workoutCount += bucket.WorkoutCount
		burned += bucket.BurnedCalories
	}
	targets := stats.Plan.Targets

	switch {
	case totalLogs == 0:
		fmt.Fprintf(&b, "No food logs were recorded between %s and %s, so there are no intake patterns to observe yet. Logging even one meal a day builds a picture of your habits over time.",
			stats.StartDate, stats.EndDate)
	case targets == nil || stats.Averages == nil:
		a := stats.Averages
		if a != nil {
			fmt.Fprintf(&b, "Across %d logged day(s) between %s and %s you averaged %.0f kcal, %.0fg protein, %.0fg carbs and %.0fg fat per day.",
				loggedDays, stats.StartDate, stats.EndDate, a.Calories, a.ProteinG, a.CarbsG, a.FatG)
		}
		b.WriteString(" Complete your profile (birth date, sex, height, weight, activity level, goal) to unlock a personalized plan and see how your intake compares.")
	default:
		a := stats.Averages
		fmt.Fprintf(&b, "Across %d logged day(s) between %s and %s you averaged %.0f kcal per day against a target of %.0f, %.0fg protein (target %.0f), %.0fg carbs (target %.0f) and %.0fg fat (target %.0f).",
			loggedDays, stats.StartDate, stats.EndDate,
			a.Calories, targets.Calories, a.ProteinG, targets.ProteinG, a.CarbsG, targets.CarbsG, a.FatG, targets.FatG)
		if d := stats.Deltas; d != nil {
			name, pct := biggestDelta(*d)
			switch {
			case pct <= -5:
				fmt.Fprintf(&b, " Your most notable pattern is a %s shortfall of about %.0f%% below target.", name, math.Abs(pct))
			case pct >= 5:
				fmt.Fprintf(&b, " Your most notable pattern is a %s excess of about %.0f%% above target.", name, pct)
			default:
				b.WriteString(" Overall your intake tracked closely to your targets — a well-balanced period.")
			}
		}
	}

	if workoutCount > 0 {
		fmt.Fprintf(&b, " You logged %d workout(s) burning roughly %.0f kcal in total.", workoutCount, burned)
	}
	if n := len(stats.Weights); n >= 2 {
		delta := stats.Weights[n-1].WeightKg - stats.Weights[0].WeightKg
		switch {
		case delta <= -0.1:
			fmt.Fprintf(&b, " Your weight moved down by %.1f kg over the period.", math.Abs(delta))
		case delta >= 0.1:
			fmt.Fprintf(&b, " Your weight moved up by %.1f kg over the period.", delta)
		default:
			b.WriteString(" Your weight held steady over the period.")
		}
	}

	switch {
	case stats.Streak.CurrentDays >= 3:
		fmt.Fprintf(&b, " You're on a %d-day tracking streak — keep it going!", stats.Streak.CurrentDays)
	case stats.Streak.LongestDays >= 3:
		fmt.Fprintf(&b, " Your longest tracking streak so far is %d days; consistent tracking makes these patterns more reliable.", stats.Streak.LongestDays)
	}

	return Insight{Text: b.String(), GeneratedBy: "stub"}, nil
}

// biggestDelta returns the nutrient with the largest absolute deviation.
func biggestDelta(d Deltas) (string, float64) {
	name, pct := "calorie", d.CaloriesPct
	if math.Abs(d.ProteinPct) > math.Abs(pct) {
		name, pct = "protein", d.ProteinPct
	}
	if math.Abs(d.CarbsPct) > math.Abs(pct) {
		name, pct = "carbohydrate", d.CarbsPct
	}
	if math.Abs(d.FatPct) > math.Abs(pct) {
		name, pct = "fat", d.FatPct
	}
	return name, pct
}
