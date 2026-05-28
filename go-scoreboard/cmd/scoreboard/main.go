package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/stevebargelt/wnba-led-scoreboard/go-scoreboard/internal/display"
	"github.com/stevebargelt/wnba-led-scoreboard/go-scoreboard/internal/scenes"
	"github.com/stevebargelt/wnba-led-scoreboard/go-scoreboard/internal/sports"
)

const (
	width  = 64
	height = 32
)

func main() {
	sim := flag.Bool("sim", false, "use simulator display (saves to out/frame.png)")
	once := flag.Bool("once", false, "render a single frame and exit")
	tickMs := flag.Int("tick-ms", 1000, "render interval in milliseconds")
	fetchWNBA := flag.Bool("fetch-wnba", false, "fetch today's WNBA games and print, then exit")
	demo := flag.Bool("demo", false, "fetch live WNBA games and render the first one (falls back to Idle)")
	assetsDir := flag.String("assets-dir", "../assets", "path to assets directory (for team logos)")
	flag.Parse()

	if *fetchWNBA {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		games, err := sports.FetchWNBA(ctx, time.Now())
		if err != nil {
			fmt.Fprintf(os.Stderr, "fetch: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Fetched %d game(s):\n", len(games))
		for _, g := range games {
			fmt.Printf("  [%s] %s @ %s  %d-%d  P%d %s  (%s)\n",
				g.State, g.Away.Abbr, g.Home.Abbr,
				g.Away.Score, g.Home.Score,
				g.Period, g.DisplayClock, g.StatusDetail)
		}
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

	chooseScene := func() scenes.Scene { return scenes.Idle{} }
	if *demo {
		chooseScene = makeDemoSelector(*assetsDir)
	}

	render := func() { d.SetImage(chooseScene().Render(width, height, time.Now())) }
	render()
	if *once {
		return
	}

	ticker := time.NewTicker(time.Duration(*tickMs) * time.Millisecond)
	defer ticker.Stop()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	fmt.Println("Rendering. Ctrl+C to exit.")

	for {
		select {
		case <-ticker.C:
			render()
		case <-stop:
			return
		}
	}
}

func makeDemoSelector(assetsDir string) func() scenes.Scene {
	var (
		cached     []sports.GameSnapshot
		lastFetch  time.Time
		fetchEvery = 30 * time.Second
	)
	return func() scenes.Scene {
		if time.Since(lastFetch) > fetchEvery {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			games, err := sports.FetchWNBA(ctx, time.Now())
			cancel()
			if err == nil {
				cached = games
				lastFetch = time.Now()
			}
		}
		for _, g := range cached {
			if g.State == sports.StateLive {
				return scenes.Live{Game: g, AssetsDir: assetsDir}
			}
		}
		return scenes.Idle{}
	}
}
