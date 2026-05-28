package display

import "image"

type Display interface {
	Init() error
	SetImage(img *image.RGBA)
	// SetBrightness sets panel brightness as a percentage (1–100). Values
	// outside that range are ignored by implementations.
	SetBrightness(pct int)
	Close()
}

func NewImage(width, height int) *image.RGBA {
	return image.NewRGBA(image.Rect(0, 0, width, height))
}
