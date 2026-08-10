// Package export builds the five-sheet xlsx workbook with all of a user's
// tracked data (food logs, workouts, weights, habit logs, diary entries).
package export

import (
	"fmt"
	"io"
	"time"

	"github.com/xuri/excelize/v2"
)

// FoodLogRow is one food log entry destined for the workbook.
type FoodLogRow struct {
	LoggedAt int64 // unix seconds, UTC
	FoodName string
	Serving  string
	Calories float64
	ProteinG float64
	CarbsG   float64
	FatG     float64
}

// WorkoutRow is one workout entry destined for the workbook.
type WorkoutRow struct {
	LoggedAt    int64
	Activity    string
	DurationMin int
	Intensity   string
	Calories    float64
	Estimated   bool
	Notes       string
}

// WeightRow is one weight measurement destined for the workbook.
type WeightRow struct {
	MeasuredAt int64
	WeightKg   float64
}

// HabitLogRow is one habit log (joined with its habit) destined for the
// workbook.
type HabitLogRow struct {
	LoggedAt  int64
	HabitName string
	Kind      string
	Count     int64
	Unit      string
}

// DiaryRow is one diary entry destined for the workbook.
type DiaryRow struct {
	Date   string // YYYY-MM-DD, already local
	Mood   *int64
	Energy *int64
	Text   string
}

// Data is everything WriteXLSX renders; every slice must be ordered oldest
// first.
type Data struct {
	FoodLogs  []FoodLogRow
	Workouts  []WorkoutRow
	Weights   []WeightRow
	HabitLogs []HabitLogRow
	Diary     []DiaryRow
}

// Sheet names and header rows, exactly as the contract specifies.
var (
	foodLogsHeader = []any{"Logged At (local)", "Food", "Serving", "Calories", "Protein (g)", "Carbs (g)", "Fat (g)"}
	workoutsHeader = []any{"Logged At (local)", "Activity", "Duration (min)", "Intensity", "Calories", "Estimated", "Notes"}
	weightsHeader  = []any{"Measured At (local)", "Weight (kg)"}
	habitsHeader   = []any{"Date (local)", "Habit", "Kind", "Count", "Unit"}
	diaryHeader    = []any{"Date", "Mood (1-5)", "Energy (1-5)", "Text"}
)

// WriteXLSX writes the five-sheet workbook to w. Timestamps are rendered in
// loc as "YYYY-MM-DD HH:MM"; date-keyed sheets use "YYYY-MM-DD".
func WriteXLSX(w io.Writer, data Data, loc *time.Location) error {
	f := excelize.NewFile()
	defer f.Close()

	local := func(unix int64) string {
		return time.Unix(unix, 0).In(loc).Format("2006-01-02 15:04")
	}
	localDay := func(unix int64) string {
		return time.Unix(unix, 0).In(loc).Format("2006-01-02")
	}

	sheets := []struct {
		name   string
		header []any
		count  int
		row    func(i int) []any
	}{
		{"Food Logs", foodLogsHeader, len(data.FoodLogs), func(i int) []any {
			r := data.FoodLogs[i]
			return []any{local(r.LoggedAt), r.FoodName, r.Serving, r.Calories, r.ProteinG, r.CarbsG, r.FatG}
		}},
		{"Workouts", workoutsHeader, len(data.Workouts), func(i int) []any {
			r := data.Workouts[i]
			return []any{local(r.LoggedAt), r.Activity, r.DurationMin, r.Intensity, r.Calories, r.Estimated, r.Notes}
		}},
		{"Weights", weightsHeader, len(data.Weights), func(i int) []any {
			r := data.Weights[i]
			return []any{local(r.MeasuredAt), r.WeightKg}
		}},
		{"Habits", habitsHeader, len(data.HabitLogs), func(i int) []any {
			r := data.HabitLogs[i]
			return []any{localDay(r.LoggedAt), r.HabitName, r.Kind, r.Count, r.Unit}
		}},
		{"Diary", diaryHeader, len(data.Diary), func(i int) []any {
			r := data.Diary[i]
			return []any{r.Date, intCell(r.Mood), intCell(r.Energy), r.Text}
		}},
	}

	for si, sheet := range sheets {
		if si == 0 {
			if err := f.SetSheetName(f.GetSheetName(0), sheet.name); err != nil {
				return fmt.Errorf("rename sheet: %w", err)
			}
		} else if _, err := f.NewSheet(sheet.name); err != nil {
			return fmt.Errorf("create sheet %s: %w", sheet.name, err)
		}
		if err := f.SetSheetRow(sheet.name, "A1", &sheet.header); err != nil {
			return fmt.Errorf("write %s header: %w", sheet.name, err)
		}
		for i := 0; i < sheet.count; i++ {
			cell, err := excelize.CoordinatesToCellName(1, i+2)
			if err != nil {
				return err
			}
			row := sheet.row(i)
			if err := f.SetSheetRow(sheet.name, cell, &row); err != nil {
				return fmt.Errorf("write %s row %d: %w", sheet.name, i+2, err)
			}
		}
	}
	return f.Write(w)
}

// intCell renders a nullable integer as an empty cell when nil.
func intCell(v *int64) any {
	if v == nil {
		return ""
	}
	return *v
}
