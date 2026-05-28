package sports

import "time"

// parseEventTime parses the start-time strings returned by ESPN/NHLE. ESPN omits
// seconds (e.g. "2026-05-29T00:00Z"), which time.RFC3339 rejects, so try a few
// layouts. Returns the zero time if none match; callers must guard for that.
func parseEventTime(s string) time.Time {
	layouts := []string{
		time.RFC3339,
		"2006-01-02T15:04Z07:00",
	}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	return time.Time{}
}

type GameState int

const (
	StateUnknown GameState = iota
	StatePre
	StateLive
	StateFinal
)

func (s GameState) String() string {
	switch s {
	case StatePre:
		return "pre"
	case StateLive:
		return "live"
	case StateFinal:
		return "final"
	}
	return "unknown"
}

type Team struct {
	ID    string
	Name  string
	Abbr  string
	Score int
}

type GameSnapshot struct {
	League       string
	EventID      string
	StartTime    time.Time
	State        GameState
	Home         Team
	Away         Team
	Period       int
	DisplayClock string
	StatusDetail string
}
