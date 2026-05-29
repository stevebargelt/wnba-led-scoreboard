package sports

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

const wnbaScoreboardURL = "http://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard"

func FetchWNBA(ctx context.Context, day time.Time) ([]GameSnapshot, error) {
	url := wnbaScoreboardURL + "?dates=" + day.Format("20060102")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("wnba fetch: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("wnba fetch: status %d", resp.StatusCode)
	}

	var parsed struct {
		Events []espnEvent `json:"events"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("wnba decode: %w", err)
	}

	out := make([]GameSnapshot, 0, len(parsed.Events))
	for _, e := range parsed.Events {
		if s, ok := parseEvent("wnba", e); ok {
			out = append(out, s)
		}
	}
	return out, nil
}

type espnEvent struct {
	ID           string            `json:"id"`
	Date         string            `json:"date"`
	Competitions []espnCompetition `json:"competitions"`
}

type espnCompetition struct {
	Competitors []espnCompetitor `json:"competitors"`
	Status      espnStatus       `json:"status"`
}

type espnCompetitor struct {
	HomeAway string   `json:"homeAway"`
	Score    string   `json:"score"`
	Team     espnTeam `json:"team"`
}

type espnTeam struct {
	ID           string `json:"id"`
	DisplayName  string `json:"displayName"`
	Abbreviation string `json:"abbreviation"`
}

type espnStatus struct {
	Type         espnStatusType `json:"type"`
	Period       int            `json:"period"`
	DisplayClock string         `json:"displayClock"`
}

type espnStatusType struct {
	State     string `json:"state"`
	Completed bool   `json:"completed"`
	Detail    string `json:"detail"`
}

func parseEvent(league string, e espnEvent) (GameSnapshot, bool) {
	if len(e.Competitions) == 0 {
		return GameSnapshot{}, false
	}
	c := e.Competitions[0]
	var home, away Team
	var haveHome, haveAway bool
	for _, comp := range c.Competitors {
		score, _ := strconv.Atoi(comp.Score)
		t := Team{
			ID:    comp.Team.ID,
			Name:  comp.Team.DisplayName,
			Abbr:  comp.Team.Abbreviation,
			Score: score,
		}
		switch comp.HomeAway {
		case "home":
			home = t
			haveHome = true
		case "away":
			away = t
			haveAway = true
		}
	}
	if !haveHome || !haveAway {
		return GameSnapshot{}, false
	}

	start := parseEventTime(e.Date)

	return GameSnapshot{
		League:       league,
		EventID:      e.ID,
		StartTime:    start,
		State:        stateFor(c.Status.Type),
		Home:         home,
		Away:         away,
		Period:       c.Status.Period,
		DisplayClock: c.Status.DisplayClock,
		StatusDetail: c.Status.Type.Detail,
	}, true
}

// stateFor maps an ESPN status to a GameState. A completed game is Final even
// when ESPN still reports state "in" at the final buzzer (period 4, clock
// 0:00) — without the completed check that renders as "4th 0:00" and never
// flips to Final.
func stateFor(t espnStatusType) GameState {
	if t.Completed {
		return StateFinal
	}
	switch t.State {
	case "pre":
		return StatePre
	case "in":
		return StateLive
	case "post":
		return StateFinal
	}
	return StateUnknown
}
