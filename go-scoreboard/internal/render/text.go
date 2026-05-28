package render

import (
	"image"
	"image/color"

	"golang.org/x/image/font"
	"golang.org/x/image/math/fixed"
)

type Align int

const (
	AlignLeft Align = iota
	AlignCenter
	AlignRight
)

// DrawText renders s at (x, baselineY). For AlignCenter / AlignRight, x is
// the centerline / right edge respectively.
func DrawText(img *image.RGBA, s string, face font.Face, c color.Color, x, baselineY int, align Align) {
	w := font.MeasureString(face, s).Round()
	switch align {
	case AlignCenter:
		x -= w / 2
	case AlignRight:
		x -= w
	}
	d := &font.Drawer{
		Dst:  img,
		Src:  image.NewUniform(c),
		Face: face,
		Dot:  fixed.Point26_6{X: fixed.I(x), Y: fixed.I(baselineY)},
	}
	d.DrawString(s)
}
