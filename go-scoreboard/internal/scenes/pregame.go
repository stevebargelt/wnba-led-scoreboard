package scenes

import (
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
	Loc       *time.Location
}

func (p Pregame) Render(width, height int, _ time.Time) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.Draw(img, img.Bounds(), image.NewUniform(color.Black), image.Point{}, draw.Src)

	smallFace, err := render.Face(render.Font04B03, 8)
	if err != nil {
		return img
	}
	timeFace, err := render.Face(render.Font04B24, 16)
	if err != nil {
		return img
	}

	abbrColor := color.RGBA{R: 220, G: 220, B: 220, A: 255}
	amber := color.RGBA{R: 255, G: 200, B: 0, A: 255}

	const (
		logoSize  = 10
		logoY     = 1
		abbrBaseY = 9
	)
	awayLogoX := 2
	homeLogoX := width - logoSize - 2

	if logo := render.Logo(p.AssetsDir, p.Game.Away.ID, render.LogoMini); logo != nil {
		draw.Draw(img, image.Rect(awayLogoX, logoY, awayLogoX+logoSize, logoY+logoSize), logo, image.Point{}, draw.Over)
	}
	if logo := render.Logo(p.AssetsDir, p.Game.Home.ID, render.LogoMini); logo != nil {
		draw.Draw(img, image.Rect(homeLogoX, logoY, homeLogoX+logoSize, logoY+logoSize), logo, image.Point{}, draw.Over)
	}

	render.DrawText(img, abbr(p.Game.Away.Abbr), smallFace, abbrColor, awayLogoX+logoSize+2, abbrBaseY, render.AlignLeft)
	render.DrawText(img, abbr(p.Game.Home.Abbr), smallFace, abbrColor, homeLogoX-2, abbrBaseY, render.AlignRight)

	startLocal := "TBD"
	if !p.Game.StartTime.IsZero() {
		startLocal = p.Game.StartTime.In(locOr(p.Loc)).Format("3:04 PM")
	}
	render.DrawText(img, startLocal, timeFace, amber, width/2, height-7, render.AlignCenter)

	return img
}

func abbr(s string) string {
	if len(s) > 4 {
		return s[:4]
	}
	return s
}

// locOr returns loc, or the system local zone when loc is nil (e.g. demo mode
// or an unset/invalid configured timezone).
func locOr(loc *time.Location) *time.Location {
	if loc == nil {
		return time.Local
	}
	return loc
}
