// Package insights generates natural-language nutrition insights from
// report statistics, via a pluggable provider.
package insights

import (
	"context"

	"helsa/backend/internal/reports"
)

// Disclaimer is attached to every insight response regardless of provider.
const Disclaimer = "These are general nutrition pattern observations, not medical advice or diagnosis. Consult a healthcare professional for medical guidance."

// ReportStats is the aggregated report data an insight is generated from.
type ReportStats = reports.Stats

// Insight is a generated observation and the id of the provider that made it.
type Insight struct {
	Text        string
	GeneratedBy string // "stub" | "openrouter"
}

// Provider generates an insight from report statistics.
type Provider interface {
	GenerateInsight(ctx context.Context, stats ReportStats) (Insight, error)
}

// Deltas is re-exported for provider implementations.
type Deltas = reports.Deltas
