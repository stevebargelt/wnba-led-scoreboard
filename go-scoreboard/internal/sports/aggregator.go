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

// favRank returns the best (lowest) favorite rank among a game's two teams and
// whether either is a favorite. Rank is the team's position in the device's
// per-league favorite order — 0 is the top favorite, so lower wins.
func favRank(g GameSnapshot, favorites map[string]map[string]int) (int, bool) {
	teams := favorites[g.League]
	if teams == nil {
		return 0, false
	}
	best, ok := 0, false
	if r, has := teams[g.Home.ID]; has {
		best, ok = r, true
	}
	if r, has := teams[g.Away.ID]; has && (!ok || r < best) {
		best, ok = r, true
	}
	return best, ok
}

// SelectGame picks the most interesting game to display from a list. Game state
// is the primary axis (live > pregame > final); within a state, a favorite team
// outranks a non-favorite, and among favorites the higher-ranked one (lower
// favorite rank) wins. Preference order:
//   1) Live: favorite by rank, else any live
//   2) Pregame: favorite by rank, else soonest start
//   3) Final: favorite by rank, else most recently started
//
// favorites maps league -> teamID -> rank (0 = top favorite). Returns nil if no
// games match.
func SelectGame(games []GameSnapshot, favorites map[string]map[string]int) *GameSnapshot {
	if len(games) == 0 {
		return nil
	}

	byState := map[GameState][]GameSnapshot{}
	for _, g := range games {
		byState[g.State] = append(byState[g.State], g)
	}

	// pick sorts a same-state tier so favorites lead (by rank), then non-favorites
	// by the tier's secondary key, and returns the top game.
	pick := func(tier []GameSnapshot, secondaryLess func(a, b GameSnapshot) bool) *GameSnapshot {
		sort.SliceStable(tier, func(i, j int) bool {
			ri, fi := favRank(tier[i], favorites)
			rj, fj := favRank(tier[j], favorites)
			if fi != fj {
				return fi // a favorite outranks a non-favorite
			}
			if fi && fj && ri != rj {
				return ri < rj // both favorites: lower rank wins
			}
			return secondaryLess(tier[i], tier[j])
		})
		return &tier[0]
	}

	// Live: keep input order for non-favorites (stable sort just floats favorites up).
	if live := byState[StateLive]; len(live) > 0 {
		return pick(live, func(a, b GameSnapshot) bool { return false })
	}
	// Pregame: soonest start first among non-favorites.
	if pre := byState[StatePre]; len(pre) > 0 {
		return pick(pre, func(a, b GameSnapshot) bool { return a.StartTime.Before(b.StartTime) })
	}
	// Final: most recently started first among non-favorites.
	if fin := byState[StateFinal]; len(fin) > 0 {
		return pick(fin, func(a, b GameSnapshot) bool { return a.StartTime.After(b.StartTime) })
	}

	return nil
}

type unknownLeagueError string

func (e unknownLeagueError) Error() string { return "unknown league: " + string(e) }

func errUnknownLeague(code string) error { return unknownLeagueError(code) }
