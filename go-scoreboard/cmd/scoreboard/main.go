package main

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/stevebargelt/wnba-led-scoreboard/go-scoreboard/internal/display"
	"github.com/stevebargelt/wnba-led-scoreboard/go-scoreboard/internal/scenes"
)

const (
	width  = 64
	height = 32
)

func main() {
	sim := flag.Bool("sim", false, "use simulator display (saves to out/frame.png)")
	once := flag.Bool("once", false, "render a single frame and exit")
	tickMs := flag.Int("tick-ms", 1000, "render interval in milliseconds")
	flag.Parse()

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

	scene := scenes.Idle{}

	render := func() { d.SetImage(scene.Render(width, height, time.Now())) }
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
