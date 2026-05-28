package scenes

import (
	"image"
	"time"
)

type Scene interface {
	Render(width, height int, now time.Time) *image.RGBA
}
