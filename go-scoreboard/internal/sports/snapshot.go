package sports

import "time"

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
