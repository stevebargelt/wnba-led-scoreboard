package render

import (
	_ "embed"
	"fmt"
	"sync"

	"golang.org/x/image/font"
	"golang.org/x/image/font/opentype"
)

//go:embed assets/04B_03B_.TTF
var font04B03Data []byte

//go:embed assets/04B_24__.TTF
var font04B24Data []byte

//go:embed assets/score_large.otf
var fontScoreLargeData []byte

type FontName string

const (
	Font04B03      FontName = "04B_03"
	Font04B24      FontName = "04B_24"
	FontScoreLarge FontName = "score_large"
)

var fontData = map[FontName][]byte{
	Font04B03:      font04B03Data,
	Font04B24:      font04B24Data,
	FontScoreLarge: fontScoreLargeData,
}

type faceKey struct {
	name FontName
	size float64
}

var (
	faceCache = map[faceKey]font.Face{}
	cacheMu   sync.Mutex
)

func Face(name FontName, size float64) (font.Face, error) {
	k := faceKey{name, size}
	cacheMu.Lock()
	defer cacheMu.Unlock()
	if f, ok := faceCache[k]; ok {
		return f, nil
	}
	data, ok := fontData[name]
	if !ok {
		return nil, fmt.Errorf("unknown font %q", name)
	}
	parsed, err := opentype.Parse(data)
	if err != nil {
		return nil, fmt.Errorf("parse %s: %w", name, err)
	}
	face, err := opentype.NewFace(parsed, &opentype.FaceOptions{
		Size:    size,
		DPI:     72,
		Hinting: font.HintingNone,
	})
	if err != nil {
		return nil, fmt.Errorf("new face %s@%g: %w", name, size, err)
	}
	faceCache[k] = face
	return face, nil
}
