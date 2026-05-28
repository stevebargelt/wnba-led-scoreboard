package display

import (
	"image"
	"image/png"
	"os"
)

type SimulatorDisplay struct{}

func (s *SimulatorDisplay) Init() error {
	return os.MkdirAll("out", 0755)
}

func (s *SimulatorDisplay) SetImage(img *image.RGBA) {
	f, err := os.Create("out/frame.png")
	if err != nil {
		return
	}
	defer f.Close()
	png.Encode(f, img)
}

func (s *SimulatorDisplay) SetBrightness(pct int) {}

func (s *SimulatorDisplay) Close() {}
