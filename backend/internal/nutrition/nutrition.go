// Package nutrition contains pure functions for computing daily nutrition
// targets from a user's biometric profile (Mifflin-St Jeor).
package nutrition

import "math"

// Profile is the subset of biometric data needed to compute targets.
// Every field is optional; targets exist only when all five are present.
type Profile struct {
	Age           *int
	Sex           *string // "male" | "female"
	WeightKg      *float64
	HeightCm      *float64
	ActivityLevel *string // "sedentary"|"light"|"moderate"|"active"|"very_active"
}

// Targets are daily nutrition targets, rounded to whole numbers.
type Targets struct {
	Calories float64 `json:"calories"`
	ProteinG float64 `json:"protein_g"`
	CarbsG   float64 `json:"carbs_g"`
	FatG     float64 `json:"fat_g"`
}

// ActivityMultipliers maps activity levels to their TDEE multipliers.
var ActivityMultipliers = map[string]float64{
	"sedentary":   1.2,
	"light":       1.375,
	"moderate":    1.55,
	"active":      1.725,
	"very_active": 1.9,
}

// BMR computes the Mifflin-St Jeor basal metabolic rate.
// sex must be "male" or "female"; ok is false otherwise.
func BMR(sex string, weightKg, heightCm float64, age int) (float64, bool) {
	base := 10*weightKg + 6.25*heightCm - 5*float64(age)
	switch sex {
	case "male":
		return base + 5, true
	case "female":
		return base - 161, true
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

// Compute returns the daily targets for a profile: calories = round(TDEE),
// then a 30/40/30 protein/carbs/fat split (protein and carbs at 4 kcal/g,
// fat at 9 kcal/g), each rounded to a whole number. ok is false when any of
// the five biometrics is missing or invalid.
func Compute(p Profile) (Targets, bool) {
	if p.Age == nil || p.Sex == nil || p.WeightKg == nil || p.HeightCm == nil || p.ActivityLevel == nil {
		return Targets{}, false
	}
	bmr, ok := BMR(*p.Sex, *p.WeightKg, *p.HeightCm, *p.Age)
	if !ok {
		return Targets{}, false
	}
	tdee, ok := TDEE(bmr, *p.ActivityLevel)
	if !ok {
		return Targets{}, false
	}
	calories := math.Round(tdee)
	return Targets{
		Calories: calories,
		ProteinG: math.Round(calories * 0.30 / 4),
		CarbsG:   math.Round(calories * 0.40 / 4),
		FatG:     math.Round(calories * 0.30 / 9),
	}, true
}
