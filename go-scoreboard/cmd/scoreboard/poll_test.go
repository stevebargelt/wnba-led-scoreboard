package main

import (
	"testing"
	"time"

	"github.com/stevebargelt/wnba-led-scoreboard/go-scoreboard/internal/config"
	"github.com/stevebargelt/wnba-led-scoreboard/go-scoreboard/internal/sports"
)

func TestPollIntervalSec(t *testing.T) {
	now := time.Date(2026, 5, 28, 12, 0, 0, 0, time.UTC)
	r := config.RefreshConfig{PregameSec: 600, IngameSec: 120, FinalSec: 900}

	pre := func(start time.Time) sports.GameSnapshot {
		return sports.GameSnapshot{State: sports.StatePre, StartTime: start}
	}

	tests := []struct {
		name  string
		games []sports.GameSnapshot
		want  int
	}{
		{"no games backs off to idle", nil, idleBackoffSec},
		{"live game caps at liveMaxPollSec", []sports.GameSnapshot{{State: sports.StateLive}}, liveMaxPollSec},
		{"all-final slate uses FinalSec", []sports.GameSnapshot{{State: sports.StateFinal}}, 900},
		{"tipoff hours out backs off", []sports.GameSnapshot{pre(now.Add(6 * time.Hour))}, idleBackoffSec},
		{"tipoff within 2h uses pregame cadence", []sports.GameSnapshot{pre(now.Add(90 * time.Minute))}, 600},
		{"tipoff within 30m tightens to 2m", []sports.GameSnapshot{pre(now.Add(20 * time.Minute))}, 120},
		{"tipoff imminent tightens to 30s", []sports.GameSnapshot{pre(now.Add(3 * time.Minute))}, minPollSec},
		{"past tipoff still pre polls fast", []sports.GameSnapshot{pre(now.Add(-2 * time.Minute))}, minPollSec},
		{"live wins over later pregame", []sports.GameSnapshot{{State: sports.StateLive}, pre(now.Add(3 * time.Hour))}, liveMaxPollSec},
		{"soonest of several pregames drives cadence", []sports.GameSnapshot{pre(now.Add(5 * time.Hour)), pre(now.Add(15 * time.Minute))}, 120},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := pollIntervalSec(tc.games, r, now); got != tc.want {
				t.Errorf("pollIntervalSec = %d, want %d", got, tc.want)
			}
		})
	}
}

func TestLoadLocation(t *testing.T) {
	if got := loadLocation("America/New_York"); got == nil || got.String() != "America/New_York" {
		t.Errorf("valid tz: got %v", got)
	}
	if got := loadLocation(""); got != time.Local {
		t.Errorf("empty tz should be system Local, got %v", got)
	}
	if got := loadLocation("Not/AZone"); got != time.Local {
		t.Errorf("invalid tz should fall back to Local, got %v", got)
	}
}
