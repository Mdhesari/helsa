package insights

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const openRouterURL = "https://openrouter.ai/api/v1/chat/completions"

const systemPrompt = "You are a health-tracking assistant for the Helsa app. " +
	"Given aggregated statistics — food logs, workouts, weight measurements and habit logs — " +
	"write roughly 120 words of general pattern observations: how average intake compared to " +
	"the plan targets, the most notable deficiency or excess, workout activity and calories " +
	"burned, the weight trend over the period, habit adherence versus daily targets, tracking " +
	"consistency, and gentle encouragement. " +
	"Strictly avoid medical diagnosis, disease-risk claims, or medical advice of any kind. " +
	"Do not prescribe supplements or treatments. Plain text only, no markdown."

// OpenRouterProvider generates insights via the OpenRouter chat-completions
// API (OpenAI-compatible).
type OpenRouterProvider struct {
	APIKey  string
	Model   string
	BaseURL string // defaults to the public OpenRouter endpoint
	Client  *http.Client
}

// NewOpenRouterProvider builds a provider with a sane request timeout.
func NewOpenRouterProvider(apiKey, model string) *OpenRouterProvider {
	return &OpenRouterProvider{
		APIKey:  apiKey,
		Model:   model,
		BaseURL: openRouterURL,
		Client:  &http.Client{Timeout: 30 * time.Second},
	}
}

type chatRequest struct {
	Model    string        `json:"model"`
	Messages []chatMessage `json:"messages"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
}

// GenerateInsight implements Provider.
func (p *OpenRouterProvider) GenerateInsight(ctx context.Context, stats ReportStats) (Insight, error) {
	payload, err := json.Marshal(chatRequest{
		Model: p.Model,
		Messages: []chatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: statsPrompt(stats)},
		},
	})
	if err != nil {
		return Insight{}, err
	}

	url := p.BaseURL
	if url == "" {
		url = openRouterURL
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return Insight{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.APIKey)

	client := p.Client
	if client == nil {
		client = &http.Client{Timeout: 30 * time.Second}
	}
	resp, err := client.Do(req)
	if err != nil {
		return Insight{}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return Insight{}, err
	}
	if resp.StatusCode != http.StatusOK {
		return Insight{}, fmt.Errorf("openrouter: status %d: %s", resp.StatusCode, truncate(string(body), 200))
	}
	var out chatResponse
	if err := json.Unmarshal(body, &out); err != nil {
		return Insight{}, fmt.Errorf("openrouter: decode response: %w", err)
	}
	if len(out.Choices) == 0 || strings.TrimSpace(out.Choices[0].Message.Content) == "" {
		return Insight{}, fmt.Errorf("openrouter: empty completion")
	}
	return Insight{Text: strings.TrimSpace(out.Choices[0].Message.Content), GeneratedBy: "openrouter"}, nil
}

// statsPrompt renders the stats as a compact JSON document for the model.
// Buckets carry burned_calories/workout_count; weights are the per-day trend
// and habits the per-day adherence series.
func statsPrompt(stats ReportStats) string {
	doc := map[string]any{
		"period":                    stats.Period,
		"start_date":                stats.StartDate,
		"end_date":                  stats.EndDate,
		"timezone":                  stats.Timezone,
		"plan":                      stats.Plan,
		"daily_buckets":             stats.Buckets,
		"weight_trend":              stats.Weights,
		"habit_series":              stats.Habits,
		"averages_over_logged_days": stats.Averages,
		"deltas_pct_vs_target":      stats.Deltas,
		"streak":                    map[string]int{"current_days": stats.Streak.CurrentDays, "longest_days": stats.Streak.LongestDays},
	}
	b, err := json.Marshal(doc)
	if err != nil {
		return fmt.Sprintf("%+v", stats)
	}
	return "Here are the user's aggregated tracking statistics:\n" + string(b)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
