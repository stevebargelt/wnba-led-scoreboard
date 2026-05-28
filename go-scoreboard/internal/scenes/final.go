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

type Final struct {
	Game      sports.GameSnapshot
	AssetsDir string
}

func (f Final) Render(width, height int, _ time.Time) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.Draw(img, img.Bounds(), image.NewUniform(color.Black), image.Point{}, draw.Src)

	smallFace, err := render.Face(render.Font04B03, 8)
	if err != nil {
		return img
	}
	scoreFace, err := render.Face(render.Font04B24, 16)
	if err != nil {
		return img
	}

	finalColor := color.RGBA{R: 255, G: 80, B: 80, A: 255}
	abbrColor := color.RGBA{R: 200, G: 200, B: 200, A: 255}
	scoreColor := color.RGBA{R: 255, G: 255, B: 255, A: 255}

	const (
		rowH        = 12
		topY        = 1
		logoX       = 1
		logoSize    = 10
		abbrX       = 13
		abbrBaseDy  = 8
		scoreBaseDy = 10
	)
	botY := topY + rowH
	scoreRightX := width - 1

	render.DrawText(img, "FINAL", smallFace, finalColor, 1, 7, render.AlignLeft)

	drawRow := func(team sports.Team, rowY int) {
		if logo := render.Logo(f.AssetsDir, team.ID, render.LogoMini); logo != nil {
			draw.Draw(img, image.Rect(logoX, rowY, logoX+logoSize, rowY+logoSize), logo, image.Point{}, draw.Over)
		}
		abbr := team.Abbr
		if len(abbr) > 4 {
			abbr = abbr[:4]
		}
		render.DrawText(img, abbr, smallFace, abbrColor, abbrX, rowY+abbrBaseDy, render.AlignLeft)
		render.DrawText(img, fmt.Sprintf("%d", team.Score), scoreFace, scoreColor, scoreRightX, rowY+scoreBaseDy, render.AlignRight)
	}

	drawRow(f.Game.Away, topY)
	drawRow(f.Game.Home, botY)
	return img
}
