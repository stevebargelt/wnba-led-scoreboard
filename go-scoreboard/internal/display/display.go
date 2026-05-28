package display

import "image"

type Display interface {
	Init() error
	SetImage(img *image.RGBA)
	Close()
}

func NewImage(width, height int) *image.RGBA {
	return image.NewRGBA(image.Rect(0, 0, width, height))
}
