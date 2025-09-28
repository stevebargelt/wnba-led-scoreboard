"""
Clock board implementation for idle display.
"""

from typing import Dict, Any
from PIL import Image, ImageDraw, ImageFont
from datetime import datetime

from src.boards.base import BoardBase


class ClockBoard(BoardBase):
    """Display current time and date when no games are active."""

    def __init__(self, config: Dict[str, Any]):
        """Initialize clock board with configuration."""
        super().__init__(config)
        self._load_fonts()
        self.show_seconds = config.get('show_seconds', False)
        self.show_date = config.get('show_date', True)
        self.time_format_24h = config.get('24h_format', False)
        self.date_format = config.get('date_format', '%a %m/%d')  # Mon 12/25
        self.animation_frame = 0

    def _load_fonts(self):
        """Load fonts for rendering."""
        try:
            # Try to load a nice font for the clock
            self._font_time_large = ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size=16
            )
            self._font_time_small = ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size=10
            )
            self._font_date = ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size=8
            )
        except Exception:
            # Fallback to default font
            self._font_time_large = ImageFont.load_default()
            self._font_time_small = ImageFont.load_default()
            self._font_date = ImageFont.load_default()

    def should_display(self, context: Dict[str, Any]) -> bool:
        """
        Display clock when idle (no active games).

        Args:
            context: Runtime context

        Returns:
            True when no game is active
        """
        # Show clock when there's no game or in idle state
        return (context.get('game_snapshot') is None or
                context.get('state') == 'idle')

    def render(self,
               buffer: Image.Image,
               draw: ImageDraw.Draw,
               context: Dict[str, Any]) -> None:
        """
        Render clock display.

        Args:
            buffer: PIL Image buffer
            draw: ImageDraw object
            context: Runtime context
        """
        now = context.get('current_time', datetime.now())

        # Clear the buffer
        draw.rectangle([(0, 0), (buffer.width - 1, buffer.height - 1)],
                      fill=(0, 0, 0))

        # Determine layout based on matrix size
        if buffer.width == 64 and buffer.height == 32:
            self._render_64x32(buffer, draw, now)
        elif buffer.width == 64 and buffer.height == 64:
            self._render_64x64(buffer, draw, now)
        else:
            # Generic rendering for other sizes
            self._render_generic(buffer, draw, now)

        # Increment animation frame
        self.animation_frame = (self.animation_frame + 1) % 60

    def _render_64x32(self,
                      buffer: Image.Image,
                      draw: ImageDraw.Draw,
                      now: datetime) -> None:
        """Render for standard 64x32 matrix."""
        # Format time
        if self.time_format_24h:
            time_str = now.strftime('%H:%M')
        else:
            time_str = now.strftime('%-I:%M')
            period = now.strftime('%p')

        # Calculate positions
        time_bbox = draw.textbbox((0, 0), time_str, font=self._font_time_large)
        time_width = time_bbox[2] - time_bbox[0]
        time_height = time_bbox[3] - time_bbox[1]

        # Center time horizontally, slightly above center vertically
        time_x = (buffer.width - time_width) // 2
        time_y = 8

        # Draw time
        draw.text((time_x, time_y), time_str,
                 fill=(255, 255, 255), font=self._font_time_large)

        # Draw AM/PM if 12-hour format
        if not self.time_format_24h:
            period_x = time_x + time_width + 2
            draw.text((period_x, time_y + 4), period,
                     fill=(180, 180, 180), font=self._font_date)

        # Draw seconds if enabled (with blinking colon effect)
        if self.show_seconds:
            seconds = now.strftime('%S')
            # Blink colon every second
            colon = ':' if self.animation_frame % 30 < 15 else ' '
            sec_str = f"{colon}{seconds}"
            sec_x = time_x + time_width + 15 if not self.time_format_24h else time_x + time_width + 2
            draw.text((sec_x, time_y + 2), sec_str,
                     fill=(100, 200, 255), font=self._font_time_small)

        # Draw date if enabled
        if self.show_date:
            date_str = now.strftime(self.date_format)
            date_bbox = draw.textbbox((0, 0), date_str, font=self._font_date)
            date_width = date_bbox[2] - date_bbox[0]
            date_x = (buffer.width - date_width) // 2
            date_y = buffer.height - 10

            draw.text((date_x, date_y), date_str,
                     fill=(150, 150, 150), font=self._font_date)

        # Draw decorative elements
        self._draw_decorations(buffer, draw, now)

    def _render_64x64(self,
                      buffer: Image.Image,
                      draw: ImageDraw.Draw,
                      now: datetime) -> None:
        """Render for 64x64 matrix with more space."""
        # Similar to 64x32 but with more vertical space
        # Can add weather, additional info, etc.
        self._render_64x32(buffer, draw, now)

    def _render_generic(self,
                        buffer: Image.Image,
                        draw: ImageDraw.Draw,
                        now: datetime) -> None:
        """Generic rendering for any size matrix."""
        # Simple centered time display
        time_str = now.strftime('%H:%M' if self.time_format_24h else '%-I:%M %p')

        # Try to center the text
        try:
            bbox = draw.textbbox((0, 0), time_str, font=self._font_time_small)
            width = bbox[2] - bbox[0]
            height = bbox[3] - bbox[1]
            x = (buffer.width - width) // 2
            y = (buffer.height - height) // 2
        except:
            x, y = 2, buffer.height // 2 - 4

        draw.text((x, y), time_str,
                 fill=(255, 255, 255), font=self._font_time_small)

    def _draw_decorations(self,
                          buffer: Image.Image,
                          draw: ImageDraw.Draw,
                          now: datetime) -> None:
        """Draw decorative elements like dots or lines."""
        # Draw corner dots that pulse
        pulse = abs(30 - (self.animation_frame % 60)) / 30.0
        brightness = int(50 + 150 * pulse)
        color = (brightness, brightness, brightness)

        # Top corners
        draw.ellipse([(2, 2), (3, 3)], fill=color)
        draw.ellipse([(buffer.width - 4, 2), (buffer.width - 3, 3)], fill=color)

        # Bottom corners
        draw.ellipse([(2, buffer.height - 4), (3, buffer.height - 3)], fill=color)
        draw.ellipse([(buffer.width - 4, buffer.height - 4),
                     (buffer.width - 3, buffer.height - 3)], fill=color)

        # Draw a subtle line
        line_color = (30, 30, 30)
        draw.line([(10, 1), (buffer.width - 10, 1)], fill=line_color)
        draw.line([(10, buffer.height - 2), (buffer.width - 10, buffer.height - 2)],
                 fill=line_color)

    def get_refresh_rate(self) -> float:
        """
        Get refresh rate for clock.

        Returns:
            1 second if showing seconds, 30 seconds otherwise
        """
        if self.show_seconds:
            return 1.0  # Update every second
        else:
            return 30.0  # Update every 30 seconds

    def on_enter(self) -> None:
        """Reset animation when board becomes active."""
        self.animation_frame = 0