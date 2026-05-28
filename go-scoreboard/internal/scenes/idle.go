package scenes

import (
	"image"
	"image/color"
	"image/draw"
	"time"

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

	render.DrawText(img, "WNBA", headerFace, teal, width/2, 7, render.AlignCenter)
	render.DrawText(img, now.Format("3:04"), clockFace, white, width/2, 26, render.AlignCenter)
	return img
}
