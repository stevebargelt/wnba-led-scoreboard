package scenes

import (
	"image"
	"image/color"
	"image/draw"
	"time"

	"golang.org/x/image/font"
	"golang.org/x/image/math/fixed"

	"github.com/stevebargelt/wnba-led-scoreboard/go-scoreboard/internal/render"
)

type Idle struct{}

func (Idle) Render(width, height int, now time.Time) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.Draw(img, img.Bounds(), image.NewUniform(color.Black), image.Point{}, draw.Src)

	headerFace, err := render.Face(render.Font04B03, 8)
	if err != nil {
		return img
	}
	clockFace, err := render.Face(render.Font04B24, 16)
	if err != nil {
		return img
	}

	teal := color.RGBA{R: 0, G: 200, B: 200, A: 255}
	white := color.RGBA{R: 230, G: 230, B: 230, A: 255}

	drawCentered(img, "WNBA", headerFace, teal, 7)
	drawCentered(img, now.Format("3:04"), clockFace, white, 26)
	return img
}

func drawCentered(img *image.RGBA, s string, face font.Face, c color.Color, baselineY int) {
	w := font.MeasureString(face, s).Round()
	x := (img.Bounds().Dx() - w) / 2
	d := &font.Drawer{
		Dst:  img,
		Src:  image.NewUniform(c),
		Face: face,
		Dot:  fixed.Point26_6{X: fixed.I(x), Y: fixed.I(baselineY)},
	}
	d.DrawString(s)
}
