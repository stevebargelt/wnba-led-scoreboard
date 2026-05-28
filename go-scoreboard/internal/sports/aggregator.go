package sports

import (
	"context"
	"sort"
	"sync"
	"time"
)

// LeagueFetcher fetches a single league's games for a date.
type LeagueFetcher func(ctx context.Context, day time.Time) ([]GameSnapshot, error)

var registry = map[string]LeagueFetcher{
	"wnba": FetchWNBA,
	"nhl":  FetchNHL,
}

// Fetcher returns the registered fetcher for a league code (or nil).
func Fetcher(code string) LeagueFetcher {
	return registry[code]
}

// FetchAll fans out fetches across the enabled leagues and aggregates the
// successful results. Individual league errors are returned in a map keyed by
// league code so callers can decide how to surface them.
func FetchAll(ctx context.Context, day time.Time, leagues []string) ([]GameSnapshot, map[string]error) {
	var (
		mu      sync.Mutex
		all     []GameSnapshot
		failures = map[string]error{}
		wg      sync.WaitGroup
	)
	for _, code := range leagues {
		f := registry[code]
		if f == nil {
			failures[code] = errUnknownLeague(code)
			continue
		}
		wg.Add(1)
		go func(code string, f LeagueFetcher) {
			defer wg.Done()
			games, err := f(ctx, day)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				failures[code] = err
				return
			}
			all = append(all, games...)
		}(code, f)
	}
	wg.Wait()
	return all, failures
}

// SelectGame picks the most interesting game to display from a list, using
// favorite team IDs (per league) as a tie-breaker. Preference order:
//   1) Live game with a favorite team
//   2) Any live game
//   3) Pregame with a favorite team starting soonest
//   4) Any pregame starting soonest
//   5) Final with a favorite team (most recently ended)
//   6) Any final
// Returns nil if no games match.
func SelectGame(games []GameSnapshot, favorites map[string]map[string]bool) *GameSnapshot {
	if len(games) == 0 {
		return nil
	}
	isFav := func(g GameSnapshot) bool {
		teams := favorites[g.League]
		if teams == nil {
			return false
		}
		return teams[g.Home.ID] || teams[g.Away.ID]
	}

	byState := map[GameState][]GameSnapshot{}
	for _, g := range games {
		byState[g.State] = append(byState[g.State], g)
	}

	// Live: favorite first, else first by event id.
	if live := byState[StateLive]; len(live) > 0 {
		for _, g := range live {
			if isFav(g) {
				return &g
			}
		}
		return &live[0]
	}

	// Pregame: soonest start first, favorite breaks ties.
	if pre := byState[StatePre]; len(pre) > 0 {
		sort.SliceStable(pre, func(i, j int) bool {
			if isFav(pre[i]) != isFav(pre[j]) {
				return isFav(pre[i])
			}
			return pre[i].StartTime.Before(pre[j].StartTime)
		})
		return &pre[0]
	}

	// Final: favorite first, else most recently started (proxy for most recent).
	if fin := byState[StateFinal]; len(fin) > 0 {
		sort.SliceStable(fin, func(i, j int) bool {
			if isFav(fin[i]) != isFav(fin[j]) {
				return isFav(fin[i])
			}
			return fin[i].StartTime.After(fin[j].StartTime)
		})
		return &fin[0]
	}

	return nil
}

type unknownLeagueError string

func (e unknownLeagueError) Error() string { return "unknown league: " + string(e) }

func errUnknownLeague(code string) error { return unknownLeagueError(code) }
