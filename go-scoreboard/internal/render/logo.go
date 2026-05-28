package render

import (
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"sync"
)

type LogoVariant string

const (
	LogoMini   LogoVariant = "mini"
	LogoBanner LogoVariant = "banner"
)

type logoKey struct {
	teamID  string
	variant LogoVariant
}

var (
	logoCache = map[logoKey]image.Image{}
	logoMu    sync.Mutex
)

// Logo returns the cached decoded image for a team, or nil if the file is missing.
// Errors other than missing-file (e.g. decode failures) return nil + an error log via the boolean.
func Logo(assetsDir, teamID string, variant LogoVariant) image.Image {
	k := logoKey{teamID, variant}
	logoMu.Lock()
	defer logoMu.Unlock()
	if img, ok := logoCache[k]; ok {
		return img
	}
	path := filepath.Join(assetsDir, "logos", "variants", fmt.Sprintf("%s_%s.png", teamID, variant))
	f, err := os.Open(path)
	if err != nil {
		logoCache[k] = nil
		return nil
	}
	defer f.Close()
	img, err := png.Decode(f)
	if err != nil {
		logoCache[k] = nil
		return nil
	}
	logoCache[k] = img
	return img
}
