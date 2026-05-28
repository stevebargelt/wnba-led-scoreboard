//go:build matrix

package display

/*
#cgo CFLAGS: -I/home/pi/rpi-rgb-led-matrix/include
#cgo LDFLAGS: -L/home/pi/rpi-rgb-led-matrix/lib -lrgbmatrix -lstdc++ -lm -lpthread -lrt
#include <led-matrix-c.h>
#include <stdlib.h>
*/
import "C"

import (
	"fmt"
	"image"
	"unsafe"
)

type MatrixDisplay struct {
	matrix *C.struct_RGBLedMatrix
	canvas *C.struct_LedCanvas
}

func (m *MatrixDisplay) Init() error {
	args := []string{
		"scoreboard",
		"--led-rows=32",
		"--led-cols=32",
		"--led-chain=2",
		"--led-parallel=1",
		"--led-pixel-mapper=Rotate:180",
		"--led-slowdown-gpio=4",
		"--led-brightness=80",
		"--led-pwm-bits=11",
		"--led-pwm-lsb-nanoseconds=130",
		"--led-gpio-mapping=adafruit-hat",
	}

	cargs := make([]*C.char, len(args))
	for i, a := range args {
		cargs[i] = C.CString(a)
	}
	defer func() {
		for _, ca := range cargs {
			C.free(unsafe.Pointer(ca))
		}
	}()

	mat := C.led_matrix_create_from_options_const_argv(
		nil,
		C.int(len(args)),
		(**C.char)(unsafe.Pointer(&cargs[0])),
	)
	if mat == nil {
		return fmt.Errorf("led_matrix_create_from_options_const_argv returned NULL (check flags)")
	}
	m.matrix = mat
	m.canvas = C.led_matrix_create_offscreen_canvas(mat)
	return nil
}

func (m *MatrixDisplay) SetImage(img *image.RGBA) {
	bounds := img.Bounds()
	w := bounds.Dx()
	h := bounds.Dy()
	for y := 0; y < h; y++ {
		rowStart := y * img.Stride
		for x := 0; x < w; x++ {
			i := rowStart + x*4
			C.led_canvas_set_pixel(
				m.canvas,
				C.int(x), C.int(y),
				C.uint8_t(img.Pix[i]),
				C.uint8_t(img.Pix[i+1]),
				C.uint8_t(img.Pix[i+2]),
			)
		}
	}
	m.canvas = C.led_matrix_swap_on_vsync(m.matrix, m.canvas)
}

// SetBrightness updates panel brightness at runtime (percentage 1–100).
// Out-of-range values are ignored so a missing/zero config can't black out
// the panel.
func (m *MatrixDisplay) SetBrightness(pct int) {
	if m.matrix == nil || pct < 1 || pct > 100 {
		return
	}
	C.led_matrix_set_brightness(m.matrix, C.uint8_t(pct))
}

func (m *MatrixDisplay) Close() {
	if m.matrix != nil {
		C.led_canvas_clear(m.canvas)
		C.led_matrix_delete(m.matrix)
		m.matrix = nil
		m.canvas = nil
	}
}
