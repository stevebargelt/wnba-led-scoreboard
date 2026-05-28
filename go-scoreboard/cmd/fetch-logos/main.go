// Command fetch-logos downloads full-color WNBA team logos from ESPN and writes
// resized mini (10x10) and banner (20x20) PNG variants used by the scoreboard.
// The previously bundled variants were white silhouettes; this regenerates them
// in color. Run from the go-scoreboard directory:
//
//	go run ./cmd/fetch-logos --assets-dir ../assets
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"image"
	"image/png"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	xdraw "golang.org/x/image/draw"
)

const espnLogoTmpl = "https://a.espncdn.com/i/teamlogos/wnba/500/%s.png"

type team struct {
	ID   string `json:"id"`
	Abbr string `json:"abbr"`
}

type teamsFile struct {
	Teams []team `json:"teams"`
}

func main() {
	assetsDir := flag.String("assets-dir", "../assets", "path to assets directory")
	flag.Parse()

	teamsPath := filepath.Join(*assetsDir, "wnba_teams.json")
	raw, err := os.ReadFile(teamsPath)
	if err != nil {
		fail("read %s: %v", teamsPath, err)
	}
	var tf teamsFile
	if err := json.Unmarshal(raw, &tf); err != nil {
		fail("parse %s: %v", teamsPath, err)
	}

	variantsDir := filepath.Join(*assetsDir, "logos", "variants")
	if err := os.MkdirAll(variantsDir, 0o755); err != nil {
		fail("mkdir %s: %v", variantsDir, err)
	}

	client := &http.Client{Timeout: 20 * time.Second}
	ok, skipped := 0, 0
	for _, t := range tf.Teams {
		src, err := download(client, fmt.Sprintf(espnLogoTmpl, strings.ToLower(t.Abbr)))
		if err != nil {
			fmt.Printf("  %-4s %-3s SKIP: %v\n", t.Abbr, t.ID, err)
			skipped++
			continue
		}
		if err := writeVariant(src, filepath.Join(variantsDir, t.ID+"_mini.png"), 10); err != nil {
			fail("write mini %s: %v", t.ID, err)
		}
		if err := writeVariant(src, filepath.Join(variantsDir, t.ID+"_banner.png"), 20); err != nil {
			fail("write banner %s: %v", t.ID, err)
		}
		fmt.Printf("  %-4s %-3s OK\n", t.Abbr, t.ID)
		ok++
	}
	fmt.Printf("Done: %d updated, %d skipped\n", ok, skipped)
}

func download(client *http.Client, url string) (image.Image, error) {
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}
	return png.Decode(resp.Body)
}

func writeVariant(src image.Image, path string, size int) error {
	dst := image.NewRGBA(image.Rect(0, 0, size, size))
	xdraw.CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), xdraw.Over, nil)
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return png.Encode(f, dst)
}

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
