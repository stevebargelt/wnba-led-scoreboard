"""
Hockey-specific scoreboard implementation.
"""

from typing import Dict, Any
from PIL import Image, ImageDraw
from datetime import datetime

from .base import BaseScoreboardBoard
from src.model.game import GameSnapshot
from src.render.scenes.pregame import draw_pregame
from src.render.scenes.live import draw_live
from src.render.scenes.final import draw_final
from src.render.scenes.live_big import draw_live_big


class HockeyScoreboardBoard(BaseScoreboardBoard):
    """NHL/hockey-specific scoreboard with periods, OT, shootout."""

    def __init__(self, config: Dict[str, Any]):
        """Initialize hockey scoreboard with configuration."""
        super().__init__(config)
        # Load fonts like renderer does
        self._load_fonts()

    def _load_fonts(self):
        """Load fonts for rendering."""
        from PIL import ImageFont
        try:
            self._font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size=8)
            self._font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size=12)
        except Exception:
            self._font_small = ImageFont.load_default()
            self._font_large = ImageFont.load_default()

    def _render_pregame(self,
                        buffer: Image.Image,
                        draw: ImageDraw.Draw,
                        snapshot: GameSnapshot,
                        context: Dict[str, Any]) -> None:
        """
        Render pregame state for hockey.

        Shows teams, start time, and any pregame info.
        """
        now_local = context.get('current_time', datetime.now())
        logo_variant = self.config.get('logo_variant', 'mini')

        # Use existing pregame rendering
        draw_pregame(buffer, draw, snapshot, now_local,
                    self._font_small, self._font_large,
                    logo_variant=logo_variant)

    def _render_live(self,
                     buffer: Image.Image,
                     draw: ImageDraw.Draw,
                     snapshot: GameSnapshot,
                     context: Dict[str, Any]) -> None:
        """
        Render live hockey game.

        Shows period (1st, 2nd, 3rd, OT, SO), time remaining,
        scores, and optionally penalties/power play status.
        """
        now_local = context.get('current_time', datetime.now())
        layout = self.config.get('live_layout', 'stacked').lower()
        logo_variant = self.config.get('logo_variant', 'mini')

        # Clear buffer
        draw.rectangle([(0, 0), (buffer.width - 1, buffer.height - 1)], fill=(0, 0, 0))

        # Use existing live rendering based on layout
        if layout == "big-logos":
            draw_live_big(buffer, draw, snapshot, now_local,
                         self._font_small, self._font_large,
                         logo_variant="banner")
        else:
            draw_live(buffer, draw, snapshot, now_local,
                     self._font_small, self._font_large,
                     logo_variant=logo_variant)

        # Future: Add hockey-specific overlays
        # - Power play indicator
        # - Penalty box timer
        # - Shots on goal if available

    def _render_final(self,
                      buffer: Image.Image,
                      draw: ImageDraw.Draw,
                      snapshot: GameSnapshot,
                      context: Dict[str, Any]) -> None:
        """
        Render final/postgame state for hockey.

        Shows final score, whether it went to OT/SO.
        """
        now_local = context.get('current_time', datetime.now())
        logo_variant = self.config.get('logo_variant', 'mini')

        # Use existing final rendering
        draw_final(buffer, draw, snapshot, now_local,
                  self._font_small, self._font_large,
                  logo_variant=logo_variant)

    def get_refresh_rate(self) -> float:
        """
        Get refresh rate for hockey games.

        Returns:
            Faster refresh during live games, slower otherwise
        """
        # We don't have game state context here yet
        # Will be improved when board has state management
        return self.config.get('refresh_rate', 2.0)  # 2 seconds for hockey