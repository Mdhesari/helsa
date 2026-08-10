package nutrition

import (
	"testing"
	"time"
)

func ptr[T any](v T) *T { return &v }

func TestAge(t *testing.T) {
	today := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name  string
		birth string
		want  int
		ok    bool
	}{
		{"birthday already passed", "1999-04-04", 27, true},
		{"birthday later this year", "1999-11-20", 26, true},
		{"birthday today counts", "1999-07-02", 27, true},
		{"birthday tomorrow does not", "1999-07-03", 26, true},
		{"malformed", "not-a-date", 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := Age(tt.birth, today)
			if ok != tt.ok || got != tt.want {
				t.Fatalf("Age(%q) = %d, %v; want %d, %v", tt.birth, got, ok, tt.want, tt.ok)
			}
		})
	}
}

func TestBMR(t *testing.T) {
	tests := []struct {
		name           string
		sex            string
		weight, height float64
		age            int
		want           float64
		ok             bool
	}{
		{"female fixture", "female", 61.5, 168, 27, 1369, true},       // 10*61.5 + 6.25*168 - 5*27 - 161
		{"male fixture", "male", 80, 180, 30, 1780, true},             // 10*80 + 6.25*180 - 5*30 + 5
		{"other is the midpoint", "other", 70, 170, 30, 1534.5, true}, // 10*70 + 6.25*170 - 5*30 - 78
		{"invalid sex", "robot", 80, 180, 30, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := BMR(tt.sex, tt.weight, tt.height, tt.age)
			if ok != tt.ok || got != tt.want {
				t.Fatalf("BMR() = %v, %v; want %v, %v", got, ok, tt.want, tt.ok)
			}
		})
	}
}

func TestComputePlan(t *testing.T) {
	now := time.Date(2026, 7, 2, 12, 0, 0, 0, time.UTC)
	// Age 27 at the reference date.
	complete := Profile{
		BirthDate: ptr("1999-04-04"), Sex: ptr("female"), WeightKg: ptr(61.5),
		HeightCm: ptr(168.0), ActivityLevel: ptr("moderate"), Goal: ptr("maintain"),
	}
	with := func(mut func(*Profile)) Profile { p := complete; mut(&p); return p }

	tests := []struct {
		name      string
		profile   Profile
		complete  bool
		bmr, tdee float64
		targets   *Targets
		projected *string
		pace      *float64
	}{
		{
			// BMR 1369 x 1.55 = 2121.95 -> tdee 2122; maintain keeps TDEE.
			name: "female moderate maintain", profile: complete, complete: true,
			bmr: 1369, tdee: 2122,
			targets: &Targets{Calories: 2122, ProteinG: 159, CarbsG: 212, FatG: 71},
		},
		{
			// 2121.95 - 0.5*7700/7 = 1571.95 -> 1572; explicit pace mirrors.
			name: "female lose explicit pace",
			profile: with(func(p *Profile) {
				p.Goal = ptr("lose")
				p.PaceKgPerWeek = ptr(0.5)
				p.TargetWeightKg = ptr(55.0)
			}),
			complete: true, bmr: 1369, tdee: 2122,
			targets: &Targets{Calories: 1572, ProteinG: 118, CarbsG: 157, FatG: 52},
			// ceil(6.5 / 0.5) = 13 weeks after 2026-07-02.
			projected: ptr("2026-10-01"),
			pace:      ptr(0.5),
		},
		{
			// pace nil defaults to 0.5 and is surfaced in the plan.
			name: "lose default pace",
			profile: with(func(p *Profile) {
				p.Goal = ptr("lose")
				p.TargetWeightKg = ptr(55.0)
			}),
			complete: true, bmr: 1369, tdee: 2122,
			targets:   &Targets{Calories: 1572, ProteinG: 118, CarbsG: 157, FatG: 52},
			projected: ptr("2026-10-01"),
			pace:      ptr(0.5),
		},
		{
			// BMR 1780 x 1.2 = 2136; gain adds 550 -> 2686.
			name: "male sedentary gain",
			profile: Profile{
				BirthDate: ptr("1996-01-15"), Sex: ptr("male"), WeightKg: ptr(80.0),
				HeightCm: ptr(180.0), ActivityLevel: ptr("sedentary"), Goal: ptr("gain"),
				TargetWeightKg: ptr(86.0), PaceKgPerWeek: ptr(0.5),
			},
			complete: true, bmr: 1780, tdee: 2136,
			targets: &Targets{Calories: 2686, ProteinG: 201, CarbsG: 269, FatG: 90},
			// ceil(6 / 0.5) = 12 weeks after 2026-07-02.
			projected: ptr("2026-09-24"),
			pace:      ptr(0.5),
		},
		{
			// other: BMR 1534.5 x 1.55 = 2378.475 -> 2378.
			name: "other sex maintain",
			profile: Profile{
				BirthDate: ptr("1996-01-15"), Sex: ptr("other"), WeightKg: ptr(70.0),
				HeightCm: ptr(170.0), ActivityLevel: ptr("moderate"), Goal: ptr("maintain"),
			},
			complete: true, bmr: 1535, tdee: 2378,
			targets: &Targets{Calories: 2378, ProteinG: 178, CarbsG: 238, FatG: 79},
		},
		{
			// TDEE 1091.5 x 1.2 = 1309.8; lose at 1.0 kg/wk -> 209.8, clamped to 1200.
			name: "clamped to 1200",
			profile: Profile{
				BirthDate: ptr("1999-04-04"), Sex: ptr("female"), WeightKg: ptr(45.0),
				HeightCm: ptr(150.0), ActivityLevel: ptr("sedentary"), Goal: ptr("lose"),
				PaceKgPerWeek: ptr(1.0),
			},
			complete: true, bmr: 1092, tdee: 1310,
			targets: &Targets{Calories: 1200, ProteinG: 90, CarbsG: 120, FatG: 40},
			pace:    ptr(1.0),
		},
		{
			// maintain never projects an end date even with a target set.
			name: "maintain has no projection",
			profile: with(func(p *Profile) {
				p.TargetWeightKg = ptr(55.0)
			}),
			complete: true, bmr: 1369, tdee: 2122,
			targets: &Targets{Calories: 2122, ProteinG: 159, CarbsG: 212, FatG: 71},
		},
		{
			// lose without a target weight: targets computed, no projection.
			name: "lose without target",
			profile: with(func(p *Profile) {
				p.Goal = ptr("lose")
			}),
			complete: true, bmr: 1369, tdee: 2122,
			targets: &Targets{Calories: 1572, ProteinG: 118, CarbsG: 157, FatG: 52},
			pace:    ptr(0.5),
		},
		{name: "missing birth date", profile: with(func(p *Profile) { p.BirthDate = nil })},
		{name: "missing sex", profile: with(func(p *Profile) { p.Sex = nil })},
		{name: "missing height", profile: with(func(p *Profile) { p.HeightCm = nil })},
		{name: "missing weight", profile: with(func(p *Profile) { p.WeightKg = nil })},
		{name: "missing activity", profile: with(func(p *Profile) { p.ActivityLevel = nil })},
		{name: "missing goal", profile: with(func(p *Profile) { p.Goal = nil })},
		{name: "empty profile", profile: Profile{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ComputePlan(tt.profile, now, time.UTC)
			if got.Complete != tt.complete {
				t.Fatalf("Complete = %v, want %v", got.Complete, tt.complete)
			}
			if !tt.complete {
				if got.BMR != nil || got.TDEE != nil || got.Targets != nil {
					t.Fatalf("incomplete plan must have nil bmr/tdee/targets: %+v", got)
				}
				return
			}
			if got.BMR == nil || *got.BMR != tt.bmr {
				t.Errorf("BMR = %v, want %v", got.BMR, tt.bmr)
			}
			if got.TDEE == nil || *got.TDEE != tt.tdee {
				t.Errorf("TDEE = %v, want %v", got.TDEE, tt.tdee)
			}
			if got.Targets == nil || *got.Targets != *tt.targets {
				t.Errorf("Targets = %+v, want %+v", got.Targets, tt.targets)
			}
			switch {
			case tt.projected == nil && got.ProjectedEndDate != nil:
				t.Errorf("ProjectedEndDate = %q, want nil", *got.ProjectedEndDate)
			case tt.projected != nil && (got.ProjectedEndDate == nil || *got.ProjectedEndDate != *tt.projected):
				t.Errorf("ProjectedEndDate = %v, want %q", got.ProjectedEndDate, *tt.projected)
			}
			if tt.pace != nil && (got.PaceKgPerWeek == nil || *got.PaceKgPerWeek != *tt.pace) {
				t.Errorf("PaceKgPerWeek = %v, want %v", got.PaceKgPerWeek, *tt.pace)
			}
		})
	}
}

func TestProjectedEndDateUsesLocalDate(t *testing.T) {
	tehran, err := time.LoadLocation("Asia/Tehran")
	if err != nil {
		t.Fatal(err)
	}
	// 22:30 UTC on 07-02 is already 07-03 in Tehran; the projection must
	// anchor on the LOCAL date.
	now := time.Date(2026, 7, 2, 22, 30, 0, 0, time.UTC)
	p := Profile{
		Goal: ptr("lose"), WeightKg: ptr(92.0), TargetWeightKg: ptr(85.0), PaceKgPerWeek: ptr(0.5),
	}
	got := ComputePlan(p, now, tehran)
	// ceil(7/0.5) = 14 weeks = 98 days after 2026-07-03.
	if got.ProjectedEndDate == nil || *got.ProjectedEndDate != "2026-10-09" {
		t.Fatalf("ProjectedEndDate = %v, want 2026-10-09", got.ProjectedEndDate)
	}
	if got.Complete {
		t.Fatal("plan with missing biometrics must be incomplete yet still project")
	}
}

func TestEstimateWorkoutCalories(t *testing.T) {
	tests := []struct {
		name      string
		activity  string
		intensity string
		duration  int
		weight    float64
		want      float64
		ok        bool
	}{
		{"running moderate contract fixture", "running", "moderate", 40, 70, 420, true}, // 9*1*70*(40/60)
		{"walking low", "walking", "low", 60, 80, 238, true},                            // 3.5*0.85*80
		{"hiit high rounds", "hiit", "high", 30, 90, 518, true},                         // 517.5 -> 518
		{"yoga default weight", "yoga", "moderate", 60, DefaultWorkoutWeightKg, 210, true},
		{"unknown activity", "flying", "moderate", 30, 70, 0, false},
		{"unknown intensity", "running", "extreme", 30, 70, 0, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := EstimateWorkoutCalories(tt.activity, tt.intensity, tt.duration, tt.weight)
			if ok != tt.ok || got != tt.want {
				t.Fatalf("EstimateWorkoutCalories() = %v, %v; want %v, %v", got, ok, tt.want, tt.ok)
			}
		})
	}
}
