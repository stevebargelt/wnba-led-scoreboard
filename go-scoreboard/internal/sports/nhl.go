package sports

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const nhlScoreboardURL = "https://api-web.nhle.com/v1/score"

func FetchNHL(ctx context.Context, day time.Time) ([]GameSnapshot, error) {
	url := nhlScoreboardURL + "/" + day.Format("2006-01-02")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("nhl fetch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("nhl fetch: status %d", resp.StatusCode)
	}

	var parsed struct {
		Games []nhlGame `json:"games"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("nhl decode: %w", err)
	}

	out := make([]GameSnapshot, 0, len(parsed.Games))
	for _, g := range parsed.Games {
		if s, ok := parseNHLGame(g); ok {
			out = append(out, s)
		}
	}
	return out, nil
}

type nhlGame struct {
	ID               int64            `json:"id"`
	StartTimeUTC     string           `json:"startTimeUTC"`
	GameState        string           `json:"gameState"`
	HomeTeam         nhlTeam          `json:"homeTeam"`
	AwayTeam         nhlTeam          `json:"awayTeam"`
	PeriodDescriptor nhlPeriodDesc    `json:"periodDescriptor"`
	Clock            nhlClock         `json:"clock"`
}

type nhlTeam struct {
	ID     int64           `json:"id"`
	Name   nhlLocalString  `json:"name"`
	Abbrev string          `json:"abbrev"`
	Score  int             `json:"score"`
}

type nhlLocalString struct {
	Default string `json:"default"`
}

type nhlPeriodDesc struct {
	Number     int    `json:"number"`
	PeriodType string `json:"periodType"`
}

type nhlClock struct {
	TimeRemaining string `json:"timeRemaining"`
}

func parseNHLGame(g nhlGame) (GameSnapshot, bool) {
	home := Team{
		ID:    fmt.Sprintf("%d", g.HomeTeam.ID),
		Name:  g.HomeTeam.Name.Default,
		Abbr:  g.HomeTeam.Abbrev,
		Score: g.HomeTeam.Score,
	}
	away := Team{
		ID:    fmt.Sprintf("%d", g.AwayTeam.ID),
		Name:  g.AwayTeam.Name.Default,
		Abbr:  g.AwayTeam.Abbrev,
		Score: g.AwayTeam.Score,
	}
	start := parseEventTime(g.StartTimeUTC)
	state := parseNHLState(g.GameState)
	clock := g.Clock.TimeRemaining
	if clock == "" {
		clock = "00:00"
	}
	return GameSnapshot{
		League:       "nhl",
		EventID:      fmt.Sprintf("%d", g.ID),
		StartTime:    start,
		State:        state,
		Home:         home,
		Away:         away,
		Period:       g.PeriodDescriptor.Number,
		DisplayClock: clock,
		StatusDetail: g.PeriodDescriptor.PeriodType,
	}, true
}

func parseNHLState(s string) GameState {
	switch strings.ToUpper(s) {
	case "FUT", "PRE":
		return StatePre
	case "LIVE", "CRIT":
		return StateLive
	case "FINAL", "OFF":
		return StateFinal
	}
	return StateUnknown
}
