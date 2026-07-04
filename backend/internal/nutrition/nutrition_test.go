package nutrition

import "testing"

func ptr[T any](v T) *T { return &v }

func TestBMR(t *testing.T) {
	tests := []struct {
		name           string
		sex            string
		weight, height float64
		age            int
		want           float64
		ok             bool
	}{
		{"female fixture", "female", 61.5, 168, 27, 1369, true}, // 10*61.5 + 6.25*168 - 5*27 - 161
		{"male fixture", "male", 80, 180, 30, 1780, true},       // 10*80 + 6.25*180 - 5*30 + 5
		{"invalid sex", "other", 80, 180, 30, 0, false},
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

func TestCompute(t *testing.T) {
	complete := Profile{
		Age: ptr(27), Sex: ptr("female"), WeightKg: ptr(61.5), HeightCm: ptr(168.0), ActivityLevel: ptr("moderate"),
	}

	tests := []struct {
		name    string
		profile Profile
		want    Targets
		ok      bool
	}{
		{
			// BMR 1369 × 1.55 = 2121.95 → 2122 kcal; 30/40/30 split.
			name:    "female moderate fixture",
			profile: complete,
			want:    Targets{Calories: 2122, ProteinG: 159, CarbsG: 212, FatG: 71},
			ok:      true,
		},
		{
			// BMR 1780 × 1.2 = 2136; protein 160.2→160, carbs 213.6→214, fat 71.2→71.
			name: "male sedentary",
			profile: Profile{
				Age: ptr(30), Sex: ptr("male"), WeightKg: ptr(80.0), HeightCm: ptr(180.0), ActivityLevel: ptr("sedentary"),
			},
			want: Targets{Calories: 2136, ProteinG: 160, CarbsG: 214, FatG: 71},
			ok:   true,
		},
		{name: "missing age", profile: func() Profile { p := complete; p.Age = nil; return p }()},
		{name: "missing sex", profile: func() Profile { p := complete; p.Sex = nil; return p }()},
		{name: "missing weight", profile: func() Profile { p := complete; p.WeightKg = nil; return p }()},
		{name: "missing height", profile: func() Profile { p := complete; p.HeightCm = nil; return p }()},
		{name: "missing activity", profile: func() Profile { p := complete; p.ActivityLevel = nil; return p }()},
		{name: "empty profile", profile: Profile{}},
		{
			name:    "invalid activity level",
			profile: func() Profile { p := complete; p.ActivityLevel = ptr("couch"); return p }(),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := Compute(tt.profile)
			if ok != tt.ok {
				t.Fatalf("Compute() ok = %v, want %v", ok, tt.ok)
			}
			if ok && got != tt.want {
				t.Fatalf("Compute() = %+v, want %+v", got, tt.want)
			}
		})
	}
}
