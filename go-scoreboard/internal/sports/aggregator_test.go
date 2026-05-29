package sports

import "testing"

func game(league, eventID string, state GameState, homeID, awayID string) GameSnapshot {
	return GameSnapshot{
		League:  league,
		EventID: eventID,
		State:   state,
		Home:    Team{ID: homeID},
		Away:    Team{ID: awayID},
	}
}

// favs builds a league->team->rank map from an ordered list of team IDs.
func favs(league string, orderedTeamIDs ...string) map[string]map[string]int {
	ranks := map[string]int{}
	for i, id := range orderedTeamIDs {
		ranks[id] = i
	}
	return map[string]map[string]int{league: ranks}
}

func TestSelectGame_NilWhenEmpty(t *testing.T) {
	if got := SelectGame(nil, nil); got != nil {
		t.Fatalf("expected nil for no games, got %+v", got)
	}
}

func TestSelectGame_LivePrefersHigherRankedFavorite(t *testing.T) {
	games := []GameSnapshot{
		game("wnba", "g1", StateLive, "home1", "away1"), // no favorite
		game("wnba", "g2", StateLive, "teamB", "x"),     // favorite rank 1
		game("wnba", "g3", StateLive, "teamA", "y"),     // favorite rank 0 (top)
	}
	got := SelectGame(games, favs("wnba", "teamA", "teamB"))
	if got == nil || got.EventID != "g3" {
		t.Fatalf("expected top-ranked favorite g3, got %+v", got)
	}
}

func TestSelectGame_LiveBeatsPregameEvenForLowerRankedFavorite(t *testing.T) {
	// Decision A: live always beats pregame. A #2 favorite that is LIVE should
	// win over a #1 favorite that is only in pregame.
	games := []GameSnapshot{
		game("wnba", "pre", StatePre, "teamA", "x"),  // top favorite, pregame
		game("wnba", "live", StateLive, "teamB", "y"), // lower favorite, live
	}
	got := SelectGame(games, favs("wnba", "teamA", "teamB"))
	if got == nil || got.EventID != "live" {
		t.Fatalf("expected live game to win over pregame favorite, got %+v", got)
	}
}

func TestSelectGame_FavoriteBeatsNonFavoriteInSameState(t *testing.T) {
	games := []GameSnapshot{
		game("wnba", "n1", StateLive, "n", "m"),       // non-favorite
		game("wnba", "fav", StateLive, "teamA", "z"),  // favorite
	}
	got := SelectGame(games, favs("wnba", "teamA"))
	if got == nil || got.EventID != "fav" {
		t.Fatalf("expected favorite to win in same state, got %+v", got)
	}
}

func TestSelectGame_NoFavoritesFallsBackToFirstLive(t *testing.T) {
	games := []GameSnapshot{
		game("wnba", "g1", StateLive, "a", "b"),
		game("wnba", "g2", StateLive, "c", "d"),
	}
	got := SelectGame(games, nil)
	if got == nil || got.EventID != "g1" {
		t.Fatalf("expected first live game with no favorites, got %+v", got)
	}
}

func TestSelectGame_RankIsPerLeague(t *testing.T) {
	// A team's rank only applies within its own league.
	games := []GameSnapshot{
		game("nhl", "nhl1", StateLive, "nhlTeam", "x"), // favorite in nhl
		game("wnba", "wnba1", StateLive, "wnbaTeam", "y"),
	}
	favorites := map[string]map[string]int{
		"nhl":  {"nhlTeam": 0},
		"wnba": {"wnbaTeam": 0},
	}
	got := SelectGame(games, favorites)
	// Both are favorites at rank 0; stable sort keeps input order, so the first wins.
	if got == nil || got.EventID != "nhl1" {
		t.Fatalf("expected stable first favorite nhl1, got %+v", got)
	}
}
