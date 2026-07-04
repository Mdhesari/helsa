// Package export builds the food-log xlsx workbook.
package export

import (
	"fmt"
	"io"
	"time"

	"github.com/xuri/excelize/v2"
)

// SheetName is the single worksheet name required by the contract.
const SheetName = "Food Logs"

// Header is the exact header row required by the contract.
var Header = []any{"Logged At (local)", "Food", "Serving", "Calories", "Protein (g)", "Carbs (g)", "Fat (g)"}

// Row is one food log entry destined for the workbook.
type Row struct {
	LoggedAt int64 // unix seconds, UTC
	FoodName string
	Serving  string
	Calories float64
	ProteinG float64
	CarbsG   float64
	FatG     float64
}

// WriteXLSX writes a workbook with one "Food Logs" sheet to w. rows must be
// ordered oldest first; timestamps are rendered in loc as "YYYY-MM-DD HH:MM".
func WriteXLSX(w io.Writer, rows []Row, loc *time.Location) error {
	f := excelize.NewFile()
	defer f.Close()

	if err := f.SetSheetName(f.GetSheetName(0), SheetName); err != nil {
		return fmt.Errorf("rename sheet: %w", err)
	}
	if err := f.SetSheetRow(SheetName, "A1", &Header); err != nil {
		return fmt.Errorf("write header: %w", err)
	}
	for i, r := range rows {
		cell, err := excelize.CoordinatesToCellName(1, i+2)
		if err != nil {
			return err
		}
		row := []any{
			time.Unix(r.LoggedAt, 0).In(loc).Format("2006-01-02 15:04"),
			r.FoodName,
			r.Serving,
			r.Calories,
			r.ProteinG,
			r.CarbsG,
			r.FatG,
		}
		if err := f.SetSheetRow(SheetName, cell, &row); err != nil {
			return fmt.Errorf("write row %d: %w", i+2, err)
		}
	}
	return f.Write(w)
}
