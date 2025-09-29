"""
Built-in scenes for display rendering.
"""

from datetime import datetime
from typing import Optional, Any

from PIL import Image, ImageDraw, ImageFont

from src.model.game import GameSnapshot, GameState
from .registry import Scene


class IdleScene(Scene):
    """Scene displayed when no games are active."""

    def draw(
        self,
        buffer: Image.Image,
        draw: ImageDraw.ImageDraw,
        snapshot: Optional[GameSnapshot],
        current_time: datetime,
        font_small: ImageFont.FreeTypeFont,
        font_large: ImageFont.FreeTypeFont,
        **kwargs: Any
    ) -> None:
        """Draw idle scene."""
        msg = current_time.strftime("%a %m/%d — No games")
        draw.text((1, 1), msg[:20], fill=(180, 180, 180), font=font_small)

    def get_name(self) -> str:
        """Get scene name."""
        return "idle"

    def get_priority(self) -> int:
        """Get scene priority."""
        return 0


class PregameScene(Scene):
    """Scene displayed before game starts."""

    def draw(
        self,
        buffer: Image.Image,
        draw: ImageDraw.ImageDraw,
        snapshot: Optional[GameSnapshot],
        current_time: datetime,
        font_small: ImageFont.FreeTypeFont,
        font_large: ImageFont.FreeTypeFont,
        **kwargs: Any
    ) -> None:
        """Draw pregame scene."""
        if snapshot:
            from src.render.scenes.pregame import draw_pregame
            logo_variant = kwargs.get("logo_variant", "small")
            draw_pregame(buffer, draw, snapshot, current_time,
                        font_small, font_large, logo_variant=logo_variant)

    def get_name(self) -> str:
        """Get scene name."""
        return "pregame"

    def get_priority(self) -> int:
        """Get scene priority."""
        return 10


class LiveScene(Scene):
    """Scene displayed during live game."""

    def draw(
        self,
        buffer: Image.Image,
        draw: ImageDraw.ImageDraw,
        snapshot: Optional[GameSnapshot],
        current_time: datetime,
        font_small: ImageFont.FreeTypeFont,
        font_large: ImageFont.FreeTypeFont,
        **kwargs: Any
    ) -> None:
        """Draw live game scene."""
        if snapshot:
            from src.render.scenes.live import draw_live
            logo_variant = kwargs.get("logo_variant", "small")
            draw_live(buffer, draw, snapshot, current_time,
                     font_small, font_large, logo_variant=logo_variant)

    def get_name(self) -> str:
        """Get scene name."""
        return "live"

    def get_priority(self) -> int:
        """Get scene priority."""
        return 20


class LiveBigScene(Scene):
    """Scene displayed during live game with big logos."""

    def draw(
        self,
        buffer: Image.Image,
        draw: ImageDraw.ImageDraw,
        snapshot: Optional[GameSnapshot],
        current_time: datetime,
        font_small: ImageFont.FreeTypeFont,
        font_large: ImageFont.FreeTypeFont,
        **kwargs: Any
    ) -> None:
        """Draw live game scene with big logos."""
        if snapshot:
            from src.render.scenes.live_big import draw_live_big
            draw_live_big(buffer, draw, snapshot, current_time,
                         font_small, font_large, logo_variant="banner")

    def get_name(self) -> str:
        """Get scene name."""
        return "live_big"

    def get_priority(self) -> int:
        """Get scene priority."""
        return 20


class FinalScene(Scene):
    """Scene displayed after game ends."""

    def draw(
        self,
        buffer: Image.Image,
        draw: ImageDraw.ImageDraw,
        snapshot: Optional[GameSnapshot],
        current_time: datetime,
        font_small: ImageFont.FreeTypeFont,
        font_large: ImageFont.FreeTypeFont,
        **kwargs: Any
    ) -> None:
        """Draw final score scene."""
        if snapshot:
            from src.render.scenes.final import draw_final
            logo_variant = kwargs.get("logo_variant", "small")
            draw_final(buffer, draw, snapshot, current_time,
                      font_small, font_large, logo_variant=logo_variant)

    def get_name(self) -> str:
        """Get scene name."""
        return "final"

    def get_priority(self) -> int:
        """Get scene priority."""
        return 15