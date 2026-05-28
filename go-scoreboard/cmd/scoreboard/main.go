package main

import (
	"flag"
	"fmt"
	"image/color"
	"os"
	"os/signal"
	"syscall"

	"github.com/stevebargelt/wnba-led-scoreboard/go-scoreboard/internal/display"
)

func main() {
	sim := flag.Bool("sim", false, "use simulator display (saves to out/frame.png)")
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

	const width, height = 64, 32
	img := display.NewImage(width, height)

	half := width / 2
	mid := height / 2

	red := color.RGBA{R: 255, A: 255}
	green := color.RGBA{G: 255, A: 255}
	blue := color.RGBA{B: 255, A: 255}
	white := color.RGBA{R: 255, G: 255, B: 255, A: 255}

	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			switch {
			case x < half && y < mid:
				img.SetRGBA(x, y, red)
			case x >= half && y < mid:
				img.SetRGBA(x, y, green)
			case x < half && y >= mid:
				img.SetRGBA(x, y, blue)
			default:
				img.SetRGBA(x, y, white)
			}
		}
	}

	d.SetImage(img)
	fmt.Println("Test pattern displayed. Press Ctrl+C to exit.")

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
}
