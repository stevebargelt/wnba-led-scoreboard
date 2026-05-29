package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/stevebargelt/wnba-led-scoreboard/go-scoreboard/internal/config"
	"github.com/stevebargelt/wnba-led-scoreboard/go-scoreboard/internal/display"
	"github.com/stevebargelt/wnba-led-scoreboard/go-scoreboard/internal/scenes"
	"github.com/stevebargelt/wnba-led-scoreboard/go-scoreboard/internal/sports"
)

const (
	width  = 64
	height = 32

	liveMaxPollSec = 15
	minPollSec     = 30
	idleBackoffSec = 1800
	// configReloadSec is how often the device re-fetches its config. This
	// doubles as the heartbeat: get_device_configuration updates
	// devices.last_seen_ts, so the web admin sees the device as online. Must
	// stay under the admin's ~90s freshness window.
	configReloadSec = 60
)

func main() {
	sim := flag.Bool("sim", false, "use simulator display (saves to out/frame.png)")
	once := flag.Bool("once", false, "render a single frame and exit")
	tickMs := flag.Int("tick-ms", 1000, "render interval in milliseconds")
	fetchWNBA := flag.Bool("fetch-wnba", false, "fetch today's WNBA games and print, then exit")
	fetchNHL := flag.Bool("fetch-nhl", false, "fetch today's NHL games and print, then exit")
	fetchConfig := flag.Bool("fetch-config", false, "fetch device config from Supabase and print, then exit")
	envFile := flag.String("env", "../.env", "path to .env file (existing vars take precedence)")
	assetsDir := flag.String("assets-dir", "../assets", "path to assets directory (for team logos)")
	demoLeagues := flag.String("demo-leagues", "", "comma-separated leagues to use without Supabase (e.g. \"wnba,nhl\")")
	flag.Parse()

	if err := config.LoadEnvFile(*envFile); err != nil {
		fmt.Fprintf(os.Stderr, "env: %v\n", err)
		os.Exit(1)
	}

	printGames := func(label string, games []sports.GameSnapshot) {
		fmt.Printf("Fetched %d %s game(s):\n", len(games), label)
		for _, g := range games {
			fmt.Printf("  [%s] %s @ %s  %d-%d  P%d %s  (%s)\n",
				g.State, g.Away.Abbr, g.Home.Abbr,
				g.Away.Score, g.Home.Score,
				g.Period, g.DisplayClock, g.StatusDetail)
		}
	}

	if *fetchWNBA {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		games, err := sports.FetchWNBA(ctx, time.Now())
		if err != nil {
			fmt.Fprintf(os.Stderr, "fetch: %v\n", err)
			os.Exit(1)
		}
		printGames("WNBA", games)
		return
	}

	if *fetchNHL {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		games, err := sports.FetchNHL(ctx, time.Now())
		if err != nil {
			fmt.Fprintf(os.Stderr, "fetch: %v\n", err)
			os.Exit(1)
		}
		printGames("NHL", games)
		return
	}

	if *fetchConfig {
		cfg, err := fetchDeviceConfig()
		if err != nil {
			fmt.Fprintf(os.Stderr, "%v\n", err)
			os.Exit(1)
		}
		printDeviceConfig(cfg)
		return
	}

	var d display.Display
	if *sim {
		d = &display.SimulatorDisplay{}
	} else {
		d = &display.MatrixDisplay{}
	}
	if err := d.Init(); err != nil {
		fmt.Fprintf(os.Stderr, "display init: %v\n", err)
		os.Exit(1)
	}
	defer d.Close()

	state := newAppState(*assetsDir, *demoLeagues)
	state.reloadConfig()
	d.SetBrightness(state.currentBrightness())
	state.refreshGames()

	render := func() { d.SetImage(state.currentScene().Render(width, height, time.Now())) }
	render()
	if *once {
		return
	}

	ticker := time.NewTicker(time.Duration(*tickMs) * time.Millisecond)
	defer ticker.Stop()
	pollC := state.pollChannel()
	configTicker := time.NewTicker(configReloadSec * time.Second)
	defer configTicker.Stop()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	hup := make(chan os.Signal, 1)
	signal.Notify(hup, syscall.SIGHUP)
	fmt.Println("Rendering. SIGHUP to reload config. Ctrl+C to exit.")

	for {
		select {
		case <-ticker.C:
			render()
		case <-pollC:
			state.refreshGames()
			pollC = state.pollChannel()
		case <-hup:
			log.Print("SIGHUP: reloading config")
			state.reloadConfig()
			d.SetBrightness(state.currentBrightness())
			state.refreshGames()
			pollC = state.pollChannel()
		case <-configTicker.C:
			// Periodic config poll = heartbeat (get_device_configuration refreshes
			// devices.last_seen_ts, so the web admin shows the device online) plus
			// auto-applying web-admin config changes without a SIGHUP. Refetch games
			// only when the enabled leagues changed, so #7's poll backoff isn't
			// undone every minute.
			if state.reloadConfig() {
				state.refreshGames()
				pollC = state.pollChannel()
			}
			d.SetBrightness(state.currentBrightness())
		case <-stop:
			return
		}
	}
}

type appState struct {
	mu          sync.RWMutex
	assetsDir   string
	demoLeagues []string
	leagues     []string
	favorites   map[string]map[string]bool
	refresh     config.RefreshConfig
	brightness  int
	loc         *time.Location
	games       []sports.GameSnapshot
	chosen      *sports.GameSnapshot
}

func newAppState(assetsDir, demoLeagues string) *appState {
	s := &appState{
		assetsDir: assetsDir,
		favorites: map[string]map[string]bool{},
		refresh: config.RefreshConfig{
			PregameSec: 600,
			IngameSec:  120,
			FinalSec:   900,
		},
	}
	if demoLeagues != "" {
		s.demoLeagues = splitCSV(demoLeagues)
	}
	return s
}

// reloadConfig re-fetches device config from Supabase (which also refreshes
// the device's last_seen_ts heartbeat) and applies it. It returns true when the
// set of enabled leagues changed, so the caller can refetch games without
// re-hitting the sports APIs on every reload.
func (s *appState) reloadConfig() bool {
	if s.demoLeagues != nil {
		s.mu.Lock()
		s.leagues = s.demoLeagues
		s.mu.Unlock()
		return false
	}
	cfg, err := fetchDeviceConfig()
	if err != nil {
		log.Printf("config fetch failed (keeping previous): %v", err)
		return false
	}
	leagues := make([]string, 0, len(cfg.EnabledLeagues))
	for _, l := range cfg.EnabledLeagues {
		leagues = append(leagues, l.Code)
	}
	favs := map[string]map[string]bool{}
	for league, teams := range cfg.FavoriteTeams {
		set := map[string]bool{}
		for _, t := range teams {
			set[t.TeamID] = true
		}
		favs[league] = set
	}
	loc := loadLocation(cfg.Timezone)
	s.mu.Lock()
	changed := !sameLeagues(s.leagues, leagues)
	s.leagues = leagues
	s.favorites = favs
	s.refresh = cfg.Refresh
	s.brightness = cfg.Matrix.Brightness
	s.loc = loc
	s.mu.Unlock()
	log.Printf("config: %d leagues (%v), refresh pre=%ds in=%ds fin=%ds, brightness=%d, tz=%s",
		len(leagues), leagues, cfg.Refresh.PregameSec, cfg.Refresh.IngameSec, cfg.Refresh.FinalSec, cfg.Matrix.Brightness, loc)
	return changed
}

// sameLeagues reports whether two league-code slices contain the same set.
func sameLeagues(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	set := make(map[string]bool, len(a))
	for _, x := range a {
		set[x] = true
	}
	for _, x := range b {
		if !set[x] {
			return false
		}
	}
	return true
}

func (s *appState) refreshGames() {
	s.mu.RLock()
	leagues := append([]string{}, s.leagues...)
	favs := s.favorites
	s.mu.RUnlock()

	if len(leagues) == 0 {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	games, failures := sports.FetchAll(ctx, time.Now(), leagues)
	cancel()
	for code, err := range failures {
		log.Printf("fetch %s: %v", code, err)
	}
	chosen := sports.SelectGame(games, favs)
	s.mu.Lock()
	s.games = games
	s.chosen = chosen
	s.mu.Unlock()
	if chosen != nil {
		log.Printf("selected: %s %s@%s state=%s", chosen.League, chosen.Away.Abbr, chosen.Home.Abbr, chosen.State)
	} else {
		log.Printf("selected: none (%d games fetched)", len(games))
	}
}

func (s *appState) currentScene() scenes.Scene {
	s.mu.RLock()
	chosen := s.chosen
	assetsDir := s.assetsDir
	loc := s.loc
	s.mu.RUnlock()
	if chosen == nil {
		return scenes.Idle{Loc: loc}
	}
	switch chosen.State {
	case sports.StatePre:
		return scenes.Pregame{Game: *chosen, AssetsDir: assetsDir, Loc: loc}
	case sports.StateLive:
		return scenes.Live{Game: *chosen, AssetsDir: assetsDir}
	case sports.StateFinal:
		return scenes.Final{Game: *chosen, AssetsDir: assetsDir}
	}
	return scenes.Idle{Loc: loc}
}

func (s *appState) pollChannel() <-chan time.Time {
	s.mu.RLock()
	games := s.games
	r := s.refresh
	s.mu.RUnlock()

	secs := pollIntervalSec(games, r, time.Now())
	t := time.NewTimer(time.Duration(secs) * time.Second)
	return t.C
}

// pollIntervalSec chooses the delay until the next game fetch. A live game polls
// fast to keep the on-screen clock current. Otherwise the cadence is aware of the
// soonest tip-off: it tightens as a game approaches and backs off hard when the
// nearest game is hours out — or when nothing is on today.
func pollIntervalSec(games []sports.GameSnapshot, r config.RefreshConfig, now time.Time) int {
	if hasState(games, sports.StateLive) {
		secs := r.IngameSec
		if secs <= 0 || secs > liveMaxPollSec {
			secs = liveMaxPollSec
		}
		return secs
	}

	if next, ok := soonestTipoff(games); ok {
		switch d := next.Sub(now); {
		case d <= 5*time.Minute:
			return minPollSec // imminent (or just passed) — catch the flip to live
		case d <= 30*time.Minute:
			return clampPoll(min(r.PregameSec, 120))
		case d <= 2*time.Hour:
			return clampPoll(r.PregameSec)
		default:
			return max(r.PregameSec, idleBackoffSec) // hours out — back off
		}
	}

	if hasState(games, sports.StateFinal) {
		return clampPoll(r.FinalSec)
	}
	return idleBackoffSec // nothing on today
}

// soonestTipoff returns the earliest start time among pregame games.
func soonestTipoff(games []sports.GameSnapshot) (time.Time, bool) {
	var next time.Time
	found := false
	for _, g := range games {
		if g.State != sports.StatePre || g.StartTime.IsZero() {
			continue
		}
		if !found || g.StartTime.Before(next) {
			next = g.StartTime
			found = true
		}
	}
	return next, found
}

func hasState(games []sports.GameSnapshot, st sports.GameState) bool {
	for _, g := range games {
		if g.State == st {
			return true
		}
	}
	return false
}

func clampPoll(secs int) int {
	if secs < minPollSec {
		return minPollSec
	}
	return secs
}

func (s *appState) currentBrightness() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.brightness
}

// loadLocation resolves a timezone name to a *time.Location, falling back to
// the system local zone for an empty or invalid name.
func loadLocation(name string) *time.Location {
	if name == "" {
		return time.Local
	}
	loc, err := time.LoadLocation(name)
	if err != nil {
		log.Printf("timezone %q invalid, using system local: %v", name, err)
		return time.Local
	}
	return loc
}

func fetchDeviceConfig() (*config.DeviceConfig, error) {
	url, err := config.MustEnv("SUPABASE_URL")
	if err != nil {
		return nil, err
	}
	anon, err := config.MustEnv("SUPABASE_ANON_KEY")
	if err != nil {
		return nil, err
	}
	dev, err := config.MustEnv("DEVICE_ID")
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return config.FetchDeviceConfig(ctx, url, anon, dev)
}

func printDeviceConfig(cfg *config.DeviceConfig) {
	fmt.Printf("Timezone: %s\n", cfg.Timezone)
	fmt.Printf("Matrix:   %dx%d brightness=%d mapper=%q\n",
		cfg.Matrix.Width, cfg.Matrix.Height, cfg.Matrix.Brightness, cfg.Matrix.PixelMapperConfig)
	fmt.Printf("Render:   layout=%s logo=%s\n", cfg.Render.LiveLayout, cfg.Render.LogoVariant)
	fmt.Printf("Refresh:  pregame=%ds ingame=%ds final=%ds\n",
		cfg.Refresh.PregameSec, cfg.Refresh.IngameSec, cfg.Refresh.FinalSec)
	fmt.Printf("Leagues:  %d enabled\n", len(cfg.EnabledLeagues))
	for _, l := range cfg.EnabledLeagues {
		fmt.Printf("  - %s\n", l.Code)
	}
	fmt.Printf("Favorites:\n")
	for league, teams := range cfg.FavoriteTeams {
		abbrs := make([]string, 0, len(teams))
		for _, t := range teams {
			abbrs = append(abbrs, t.Abbreviation)
		}
		fmt.Printf("  - %s: %v\n", league, abbrs)
	}
}

func splitCSV(s string) []string {
	out := []string{}
	cur := ""
	for _, r := range s {
		if r == ',' {
			if cur != "" {
				out = append(out, cur)
			}
			cur = ""
			continue
		}
		if r == ' ' {
			continue
		}
		cur += string(r)
	}
	if cur != "" {
		out = append(out, cur)
	}
	return out
}
