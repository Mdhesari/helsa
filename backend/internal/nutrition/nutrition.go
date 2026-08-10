// Package nutrition contains pure functions for the goal-based plan
// (Mifflin-St Jeor BMR, TDEE, pace-adjusted calorie/macro targets and the
// projected end date) and for workout calorie estimation (MET-based).
package nutrition

import (
	"math"
	"time"
)

// Profile is the v2 goal-based profile. Every field is optional; plan targets
// exist only when birth date, sex, height, weight, activity level and goal
// are all present.
type Profile struct {
	BirthDate      *string // "YYYY-MM-DD"
	Sex            *string // "male" | "female" | "other"
	HeightCm       *float64
	WeightKg       *float64
	ActivityLevel  *string // "sedentary"|"light"|"moderate"|"active"|"very_active"
	Goal           *string // "lose" | "maintain" | "gain"
	TargetWeightKg *float64
	PaceKgPerWeek  *float64 // 0.1..1.5; defaults to DefaultPace when nil
	Diet           *string
}

// Targets are daily nutrition targets, rounded to whole numbers.
type Targets struct {
	Calories float64 `json:"calories"`
	ProteinG float64 `json:"protein_g"`
	CarbsG   float64 `json:"carbs_g"`
	FatG     float64 `json:"fat_g"`
}

// Plan is the derived (never stored) goal plan from the contract. BMR, TDEE
// and Targets are nil until the plan is complete.
type Plan struct {
	Complete         bool     `json:"complete"`
	Goal             *string  `json:"goal"`
	PaceKgPerWeek    *float64 `json:"pace_kg_per_week"`
	CurrentWeightKg  *float64 `json:"current_weight_kg"`
	TargetWeightKg   *float64 `json:"target_weight_kg"`
	BMR              *float64 `json:"bmr"`
	TDEE             *float64 `json:"tdee"`
	Targets          *Targets `json:"targets"`
	ProjectedEndDate *string  `json:"projected_end_date"`
}

// DefaultPace is the pace (kg/week) assumed when the profile has none.
const DefaultPace = 0.5

// MinCalories is the floor the pace-adjusted daily calorie target is clamped to.
const MinCalories = 1200

// kcalPerKg is the energy equivalent of 1 kg of body weight.
const kcalPerKg = 7700

// ActivityMultipliers maps activity levels to their TDEE multipliers.
var ActivityMultipliers = map[string]float64{
	"sedentary":   1.2,
	"light":       1.375,
	"moderate":    1.55,
	"active":      1.725,
	"very_active": 1.9,
}

// Age returns the whole years between birthDate ("YYYY-MM-DD") and today
// (calendar date of today's year/month/day). ok is false for malformed dates.
func Age(birthDate string, today time.Time) (int, bool) {
	b, err := time.Parse("2006-01-02", birthDate)
	if err != nil {
		return 0, false
	}
	years := today.Year() - b.Year()
	if today.Month() < b.Month() || (today.Month() == b.Month() && today.Day() < b.Day()) {
		years--
	}
	return years, true
}

// BMR computes the Mifflin-St Jeor basal metabolic rate. "other" uses the
// midpoint of the male (+5) and female (-161) constants: -78.
func BMR(sex string, weightKg, heightCm float64, age int) (float64, bool) {
	base := 10*weightKg + 6.25*heightCm - 5*float64(age)
	switch sex {
	case "male":
		return base + 5, true
	case "female":
		return base - 161, true
	case "other":
		return base - 78, true
	}
	return 0, false
}

// TDEE multiplies a BMR by the activity-level multiplier.
func TDEE(bmr float64, activityLevel string) (float64, bool) {
	m, ok := ActivityMultipliers[activityLevel]
	if !ok {
		return 0, false
	}
	return bmr * m, true
}

// ComputePlan derives the full Plan from a profile. now is the current
// instant; loc is the user's timezone (age and the projected end date use the
// local calendar date). Goal, pace, current and target weight mirror the
// profile even when the plan is incomplete; pace shows the effective default
// (DefaultPace) for lose/gain goals when the profile has none.
func ComputePlan(p Profile, now time.Time, loc *time.Location) Plan {
	today := now.In(loc)
	plan := Plan{
		Goal:            p.Goal,
		PaceKgPerWeek:   p.PaceKgPerWeek,
		CurrentWeightKg: p.WeightKg,
		TargetWeightKg:  p.TargetWeightKg,
	}

	pace := DefaultPace
	if p.PaceKgPerWeek != nil {
		pace = *p.PaceKgPerWeek
	}
	losing := p.Goal != nil && (*p.Goal == "lose" || *p.Goal == "gain")
	if plan.PaceKgPerWeek == nil && losing {
		eff := pace
		plan.PaceKgPerWeek = &eff
	}

	// projected_end_date needs only goal (lose/gain), current and target weight.
	if losing && p.WeightKg != nil && p.TargetWeightKg != nil {
		weeks := int(math.Ceil(math.Abs(*p.WeightKg-*p.TargetWeightKg) / pace))
		d := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, loc).
			AddDate(0, 0, weeks*7).Format("2006-01-02")
		plan.ProjectedEndDate = &d
	}

	if p.BirthDate == nil || p.Sex == nil || p.HeightCm == nil || p.WeightKg == nil ||
		p.ActivityLevel == nil || p.Goal == nil {
		return plan
	}
	age, ok := Age(*p.BirthDate, today)
	if !ok {
		return plan
	}
	bmr, ok := BMR(*p.Sex, *p.WeightKg, *p.HeightCm, age)
	if !ok {
		return plan
	}
	tdee, ok := TDEE(bmr, *p.ActivityLevel)
	if !ok {
		return plan
	}

	calories := tdee
	switch *p.Goal {
	case "lose":
		calories -= pace * kcalPerKg / 7
	case "gain":
		calories += pace * kcalPerKg / 7
	}
	if calories < MinCalories {
		calories = MinCalories
	}
	calories = math.Round(calories)

	plan.Complete = true
	bmrOut, tdeeOut := math.Round(bmr), math.Round(tdee)
	plan.BMR = &bmrOut
	plan.TDEE = &tdeeOut
	plan.Targets = &Targets{
		Calories: calories,
		ProteinG: math.Round(calories * 0.30 / 4),
		CarbsG:   math.Round(calories * 0.40 / 4),
		FatG:     math.Round(calories * 0.30 / 9),
	}
	return plan
}

// DefaultWorkoutWeightKg is used for calorie estimates when the profile has
// no weight.
const DefaultWorkoutWeightKg = 70

// WorkoutMETs maps each workout activity to its MET value.
var WorkoutMETs = map[string]float64{
	"walking":  3.5,
	"running":  9.0,
	"cycling":  7.0,
	"swimming": 7.0,
	"strength": 4.5,
	"yoga":     3.0,
	"hiit":     10.0,
	"sports":   8.0,
	"other":    5.0,
}

// IntensityMultipliers scale a workout calorie estimate by intensity.
var IntensityMultipliers = map[string]float64{
	"low":      0.85,
	"moderate": 1.0,
	"high":     1.15,
}

// EstimateWorkoutCalories returns round(MET x intensity x weight x hours).
// ok is false for unknown activity or intensity.
func EstimateWorkoutCalories(activity, intensity string, durationMin int, weightKg float64) (float64, bool) {
	met, ok := WorkoutMETs[activity]
	if !ok {
		return 0, false
	}
	mult, ok := IntensityMultipliers[intensity]
	if !ok {
		return 0, false
	}
	return math.Round(met * mult * weightKg * float64(durationMin) / 60), true
}
