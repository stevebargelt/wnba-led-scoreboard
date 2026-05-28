package scenes

import (
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"time"

	"github.com/stevebargelt/wnba-led-scoreboard/go-scoreboard/internal/render"
	"github.com/stevebargelt/wnba-led-scoreboard/go-scoreboard/internal/sports"
)

type Pregame struct {
	Game      sports.GameSnapshot
	AssetsDir string
}

func (p Pregame) Render(width, height int, now time.Time) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.Draw(img, img.Bounds(), image.NewUniform(color.Black), image.Point{}, draw.Src)

	smallFace, err := render.Face(render.Font04B03, 8)
	if err != nil {
		return img
	}
	largeFace, err := render.Face(render.Font04B24, 16)
	if err != nil {
		return img
	}

	gray := color.RGBA{R: 200, G: 200, B: 200, A: 255}
	amber := color.RGBA{R: 255, G: 200, B: 0, A: 255}
	dim := color.RGBA{R: 150, G: 150, B: 150, A: 255}

	const (
		logoSize = 10
		topY     = 2
	)
	if logo := render.Logo(p.AssetsDir, p.Game.Away.ID, render.LogoMini); logo != nil {
		draw.Draw(img, image.Rect(2, topY, 2+logoSize, topY+logoSize), logo, image.Point{}, draw.Over)
	}
	if logo := render.Logo(p.AssetsDir, p.Game.Home.ID, render.LogoMini); logo != nil {
		hx := width - logoSize - 2
		draw.Draw(img, image.Rect(hx, topY, hx+logoSize, topY+logoSize), logo, image.Point{}, draw.Over)
	}
	render.DrawText(img, "VS", smallFace, gray, width/2, topY+8, render.AlignCenter)

	secs := int(p.Game.StartTime.Sub(now).Seconds())
	if secs < 0 {
		secs = 0
	}
	hh, mm, ss := secs/3600, (secs%3600)/60, secs%60
	var countdown string
	if hh > 0 {
		countdown = fmt.Sprintf("%d:%02d:%02d", hh, mm, ss)
	} else {
		countdown = fmt.Sprintf("%02d:%02d", mm, ss)
	}
	render.DrawText(img, countdown, largeFace, amber, width/2, height/2+7, render.AlignCenter)

	startLocal := p.Game.StartTime.Local().Format("3:04 PM")
	render.DrawText(img, "Game "+startLocal, smallFace, dim, 1, height-2, render.AlignLeft)

	return img
}
