from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

from src.config.supabase_config_loader import DeviceConfiguration
from src.model.game import GameSnapshot
from .scenes.pregame import draw_pregame
from .scenes.live import draw_live
from .scenes.final import draw_final
from .scenes.live_big import draw_live_big


class Renderer:
    def __init__(self, cfg: DeviceConfiguration, force_sim: bool = False):
        self.cfg = cfg
        self.width = cfg.matrix_config.width
        self.height = cfg.matrix_config.height
        self._buffer = Image.new("RGB", (self.width, self.height))
        self._draw = ImageDraw.Draw(self._buffer)
        self._matrix = None

        self._font_small = self._load_font(size=8)
        self._font_large = self._load_font(size=12)

        self.sim = force_sim or os.getenv("SIM_MODE", "false").lower() == "true"
        if not self.sim:
            self._try_init_matrix()
            if self._matrix is None:
                print("[info] Falling back to SIM mode (no matrix)")
                self.sim = True

        if self.sim:
            Path("out").mkdir(parents=True, exist_ok=True)

    def _try_init_matrix(self):
        try:
            from rgbmatrix import RGBMatrix, RGBMatrixOptions
        except Exception as e:
            print(f"[warn] rgbmatrix not available: {e}")
            return

        opts = RGBMatrixOptions()
        opts.rows = self.cfg.matrix_config.height
        opts.cols = self.cfg.matrix_config.width
        opts.chain_length = self.cfg.matrix_config.chain_length
        opts.parallel = self.cfg.matrix_config.parallel
        opts.gpio_slowdown = self.cfg.matrix_config.gpio_slowdown
        opts.hardware_mapping = self.cfg.matrix_config.hardware_mapping
        opts.brightness = self.cfg.matrix_config.brightness
        opts.pwm_bits = self.cfg.matrix_config.pwm_bits

        try:
            self._matrix = RGBMatrix(options=opts)
        except Exception as e:
            print(f"[warn] Failed to init RGBMatrix: {e}")
            self._matrix = None

    def _load_font(self, size: int) -> ImageFont.FreeTypeFont:
        # Use PIL default font as a baseline; replace with bitmap font later
        try:
            return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size=size)
        except Exception:
            return ImageFont.load_default()

    def clear(self, color=(0, 0, 0)):
        self._draw.rectangle((0, 0, self.width, self.height), fill=color)

    def render_idle(self, now_local: datetime):
        self.clear((0, 0, 0))
        msg = now_local.strftime("%a %m/%d — No games")
        self._draw.text((1, 1), msg[:20], fill=(180, 180, 180), font=self._font_small)

    def render_pregame(self, snap: GameSnapshot, now_local: datetime):
        self.clear((0, 0, 0))
        draw_pregame(self._buffer, self._draw, snap, now_local, self._font_small, self._font_large, logo_variant=self.cfg.render_config.logo_variant)

    def render_live(self, snap: GameSnapshot, now_local: datetime):
        self.clear((0, 0, 0))
        if (self.cfg.render_config.live_layout or "stacked").lower() == "big-logos":
            # Big-logos scene uses 20x20 target; override to banner variant
            draw_live_big(self._buffer, self._draw, snap, now_local, self._font_small, self._font_large, logo_variant="banner")
        else:
            draw_live(self._buffer, self._draw, snap, now_local, self._font_small, self._font_large, logo_variant=self.cfg.render_config.logo_variant)

    def render_final(self, snap: GameSnapshot, now_local: datetime):
        self.clear((0, 0, 0))
        draw_final(self._buffer, self._draw, snap, now_local, self._font_small, self._font_large, logo_variant=self.cfg.render_config.logo_variant)

    def flush(self):
        if self.sim or self._matrix is None:
            # Save latest frame for inspection
            self._buffer.save("out/frame.png")
        else:
            try:
                self._matrix.SetImage(self._buffer)
            except Exception as e:
                print(f"[warn] SetImage failed: {e}")

    def update_configuration(self, cfg: DeviceConfiguration):
        """Update the configuration without reinitializing the hardware."""
        self.cfg = cfg
        # Update dimensions only if they haven't changed
        if cfg.matrix_config.width == self.width and cfg.matrix_config.height == self.height:
            # Just update the configuration
            pass
        else:
            # Size changed, would need full reinit
            raise ValueError("Cannot update configuration with different dimensions")

    def close(self):
        # Nothing to close for now
        pass
