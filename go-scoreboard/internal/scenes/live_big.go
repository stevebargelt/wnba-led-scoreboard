package scenes

import (
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"time"

	xdraw "golang.org/x/image/draw"

	"github.com/stevebargelt/wnba-led-scoreboard/go-scoreboard/internal/render"
	"github.com/stevebargelt/wnba-led-scoreboard/go-scoreboard/internal/sports"
)

type LiveBig struct {
	Game      sports.GameSnapshot
	AssetsDir string
}

func (lb LiveBig) Render(width, height int, _ time.Time) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.Draw(img, img.Bounds(), image.NewUniform(color.Black), image.Point{}, draw.Src)

	smallFace, err := render.Face(render.Font04B03, 8)
	if err != nil {
		return img
	}

	statusColor := color.RGBA{R: 200, G: 200, B: 200, A: 255}
	abbrColor := color.RGBA{R: 220, G: 220, B: 220, A: 255}
	scoreColor := color.RGBA{R: 255, G: 255, B: 255, A: 255}

	render.DrawText(img, statusLine(lb.Game), smallFace, statusColor, width/2, 7, render.AlignCenter)

	const (
		logoW        = 20
		logoH        = 20
		logoY        = 8
		abbrY        = 31
		homeLogoLeft = 1
	)
	awayLogoLeft := width - logoW - 1

	// Home logo + abbr on left, away on right (matches Python live_big convention).
	pasteLogo(img, render.Logo(lb.AssetsDir, lb.Game.Home.ID, render.LogoBanner), homeLogoLeft, logoY, logoW, logoH)
	pasteLogo(img, render.Logo(lb.AssetsDir, lb.Game.Away.ID, render.LogoBanner), awayLogoLeft, logoY, logoW, logoH)

	render.DrawText(img, lb.Game.Home.Abbr, smallFace, abbrColor, homeLogoLeft+logoW/2, abbrY, render.AlignCenter)
	render.DrawText(img, lb.Game.Away.Abbr, smallFace, abbrColor, awayLogoLeft+logoW/2, abbrY, render.AlignCenter)

	mid := width / 2
	hs := fmt.Sprintf("%d", lb.Game.Home.Score)
	as := fmt.Sprintf("%d", lb.Game.Away.Score)
	render.DrawText(img, hs, smallFace, scoreColor, mid-3, 20, render.AlignRight)
	render.DrawText(img, as, smallFace, scoreColor, mid+3, 20, render.AlignLeft)

	return img
}

func pasteLogo(dst *image.RGBA, src image.Image, x, y, w, h int) {
	if src == nil {
		return
	}
	if src.Bounds().Dx() == w && src.Bounds().Dy() == h {
		draw.Draw(dst, image.Rect(x, y, x+w, y+h), src, image.Point{}, draw.Over)
		return
	}
	scaled := image.NewRGBA(image.Rect(0, 0, w, h))
	xdraw.BiLinear.Scale(scaled, scaled.Bounds(), src, src.Bounds(), xdraw.Over, nil)
	draw.Draw(dst, image.Rect(x, y, x+w, y+h), scaled, image.Point{}, draw.Over)
}
