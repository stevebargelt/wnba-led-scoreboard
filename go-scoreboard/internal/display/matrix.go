//go:build matrix

package display

import (
	"image"
	"image/draw"

	rgbmatrix "github.com/mcuadros/go-rpi-rgb-led-matrix"
)

type MatrixDisplay struct {
	matrix rgbmatrix.Matrix
	canvas *rgbmatrix.Canvas
}

func (m *MatrixDisplay) Init() error {
	cfg := rgbmatrix.DefaultConfig
	cfg.Rows = 32
	cfg.Cols = 32
	cfg.ChainLength = 2
	cfg.HardwareMapping = "adafruit-hat"
	cfg.GPIOSlowdown = 4
	cfg.PixelMapperConfig = "Rotate:180"
	cfg.Brightness = 80

	mat, err := rgbmatrix.NewRGBLedMatrix(&cfg)
	if err != nil {
		return err
	}
	m.matrix = mat
	m.canvas = rgbmatrix.NewCanvas(mat)
	return nil
}

func (m *MatrixDisplay) SetImage(img *image.RGBA) {
	draw.Draw(m.canvas, m.canvas.Bounds(), img, image.Point{}, draw.Src)
	m.canvas.Render()
}

func (m *MatrixDisplay) Close() {
	if m.canvas != nil {
		draw.Draw(m.canvas, m.canvas.Bounds(), image.NewRGBA(m.canvas.Bounds()), image.Point{}, draw.Src)
		m.canvas.Render()
		m.canvas.Close()
	}
}
