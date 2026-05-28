//go:build !matrix

package display

import (
	"errors"
	"image"
)

type MatrixDisplay struct{}

func (m *MatrixDisplay) Init() error {
	return errors.New("matrix support not compiled — build with -tags matrix")
}

func (m *MatrixDisplay) SetImage(img *image.RGBA) {}

func (m *MatrixDisplay) SetBrightness(pct int) {}

func (m *MatrixDisplay) Close() {}
