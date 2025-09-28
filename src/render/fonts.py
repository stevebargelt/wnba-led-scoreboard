"""
Font management system for LED scoreboard.

Loads fonts from configuration file and provides easy access
to different font styles for various display elements.
"""

import json
import os
from typing import Dict, Optional
from PIL import ImageFont
from functools import lru_cache


class FontManager:
    """Manages fonts for the LED display."""

    def __init__(self, config_path: str = "config/fonts.json"):
        """Initialize font manager with configuration."""
        self.config_path = config_path
        self.font_dir = "assets/fonts/pixel"
        self._fonts: Dict[str, ImageFont.FreeTypeFont] = {}
        self._config = self._load_config()

    def _load_config(self) -> Dict:
        """Load font configuration from JSON file."""
        try:
            with open(self.config_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"[FontManager] Failed to load font config: {e}")
            # Default configuration if file not found
            return {
                "default": {"font": "04B_24__.TTF", "size": 8},
                "period": {"font": "04B_24__.TTF", "size": 8},
                "clock": {"font": "04B_24__.TTF", "size": 8},
                "score": {"font": "score_large.otf", "size": 16}
            }

    @lru_cache(maxsize=32)
    def get_font(self, name: str = "default") -> Optional[ImageFont.FreeTypeFont]:
        """
        Get a font by name from configuration.

        Args:
            name: Font configuration name (default, period, clock, score, etc.)

        Returns:
            PIL ImageFont or None if not found
        """
        # Check if already loaded
        cache_key = f"{name}"
        if cache_key in self._fonts:
            return self._fonts[cache_key]

        # Get configuration for this font
        font_config = self._config.get(name, self._config.get("default"))
        if not font_config:
            print(f"[FontManager] No configuration for font '{name}'")
            return ImageFont.load_default()

        font_file = font_config.get("font")
        font_size = font_config.get("size", 8)

        # Try to load the font
        font_path = os.path.join(self.font_dir, font_file)
        try:
            font = ImageFont.truetype(font_path, size=font_size)
            self._fonts[cache_key] = font
            return font
        except Exception as e:
            print(f"[FontManager] Failed to load {font_path}: {e}")
            # Try fallback fonts
            fallback_paths = [
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
            ]
            for fallback in fallback_paths:
                try:
                    font = ImageFont.truetype(fallback, size=font_size)
                    self._fonts[cache_key] = font
                    return font
                except:
                    continue

            # Last resort: default font
            return ImageFont.load_default()

    def get_period_font(self) -> ImageFont.FreeTypeFont:
        """Get font specifically for period display."""
        return self.get_font("period")

    def get_clock_font(self) -> ImageFont.FreeTypeFont:
        """Get font specifically for clock/time display."""
        return self.get_font("clock")

    def get_score_font(self) -> ImageFont.FreeTypeFont:
        """Get font specifically for score display."""
        return self.get_font("score")

    def get_default_font(self) -> ImageFont.FreeTypeFont:
        """Get default font."""
        return self.get_font("default")


# Global font manager instance
_font_manager: Optional[FontManager] = None


def get_font_manager() -> FontManager:
    """Get or create the global font manager instance."""
    global _font_manager
    if _font_manager is None:
        _font_manager = FontManager()
    return _font_manager