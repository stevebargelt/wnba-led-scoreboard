"""
Factory for creating sport-specific scoreboards.
"""

from typing import Dict, Any, Optional
from PIL import Image, ImageDraw

from .base import BaseScoreboardBoard
from .hockey import HockeyScoreboardBoard
from .basketball import BasketballScoreboardBoard
from src.model.game import GameSnapshot


class ScoreboardFactory:
    """Factory to create appropriate scoreboard for sport."""

    # Mapping of sport codes to scoreboard classes
    SPORT_SCOREBOARDS = {
        'hockey': HockeyScoreboardBoard,
        'basketball': BasketballScoreboardBoard,
        # Future sports can be added here:
        # 'baseball': BaseballScoreboardBoard,
        # 'football': FootballScoreboardBoard,
    }

    @classmethod
    def create_scoreboard(cls, sport_code: str, config: Dict[str, Any]) -> BaseScoreboardBoard:
        """
        Create sport-specific scoreboard or fallback to base.

        Args:
            sport_code: Sport code (e.g., 'hockey', 'basketball')
            config: Board configuration dictionary

        Returns:
            Appropriate scoreboard instance for the sport
        """
        # Get sport-specific scoreboard class
        board_class = cls.SPORT_SCOREBOARDS.get(sport_code)

        if board_class:
            return board_class(config)
        else:
            # For unknown sports, use a generic scoreboard
            # (will use base rendering logic)
            print(f"[warn] No specific scoreboard for sport '{sport_code}', using generic")
            return GenericScoreboardBoard(config)

    @classmethod
    def get_supported_sports(cls) -> list[str]:
        """
        Get list of sports with specific scoreboard implementations.

        Returns:
            List of sport codes
        """
        return list(cls.SPORT_SCOREBOARDS.keys())


class GenericScoreboardBoard(BaseScoreboardBoard):
    """Generic scoreboard for sports without specific implementations."""

    def __init__(self, config: Dict[str, Any]):
        """Initialize generic scoreboard."""
        super().__init__(config)
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
        """Generic pregame rendering."""
        from datetime import datetime
        from src.render.scenes.pregame import draw_pregame

        now_local = context.get('current_time', datetime.now())
        logo_variant = self.config.get('logo_variant', 'mini')
        draw_pregame(buffer, draw, snapshot, now_local,
                    self._font_small, self._font_large,
                    logo_variant=logo_variant)

    def _render_live(self,
                     buffer: Image.Image,
                     draw: ImageDraw.Draw,
                     snapshot: GameSnapshot,
                     context: Dict[str, Any]) -> None:
        """Generic live game rendering."""
        from datetime import datetime
        from src.render.scenes.live import draw_live
        from src.render.scenes.live_big import draw_live_big

        now_local = context.get('current_time', datetime.now())
        layout = self.config.get('live_layout', 'stacked').lower()
        logo_variant = self.config.get('logo_variant', 'mini')

        draw.rectangle([(0, 0), (buffer.width - 1, buffer.height - 1)], fill=(0, 0, 0))

        if layout == "big-logos":
            draw_live_big(buffer, draw, snapshot, now_local,
                         self._font_small, self._font_large,
                         logo_variant="banner")
        else:
            draw_live(buffer, draw, snapshot, now_local,
                     self._font_small, self._font_large,
                     logo_variant=logo_variant)

    def _render_final(self,
                      buffer: Image.Image,
                      draw: ImageDraw.Draw,
                      snapshot: GameSnapshot,
                      context: Dict[str, Any]) -> None:
        """Generic final/postgame rendering."""
        from datetime import datetime
        from src.render.scenes.final import draw_final

        now_local = context.get('current_time', datetime.now())
        logo_variant = self.config.get('logo_variant', 'mini')
        draw_final(buffer, draw, snapshot, now_local,
                  self._font_small, self._font_large,
                  logo_variant=logo_variant)