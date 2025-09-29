"""
Base display implementation with common functionality.
"""

from abc import abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Tuple

from PIL import Image, ImageDraw, ImageFont

from src.config.supabase_config_loader import DeviceConfiguration
from src.core.interfaces import DisplayManager
from src.model.game import GameSnapshot, GameState
from src.display.scenes import SceneManager, SceneRegistry


@dataclass
class DisplayConfig:
    """Display-specific configuration."""
    width: int
    height: int
    brightness: int
    pwm_bits: int
    hardware_mapping: str
    chain_length: int
    parallel: int
    gpio_slowdown: int
    logo_variant: str
    live_layout: str

    @classmethod
    def from_device_config(cls, config: DeviceConfiguration) -> 'DisplayConfig':
        """Create display config from device configuration."""
        return cls(
            width=config.matrix_config.width,
            height=config.matrix_config.height,
            brightness=config.matrix_config.brightness,
            pwm_bits=config.matrix_config.pwm_bits,
            hardware_mapping=config.matrix_config.hardware_mapping,
            chain_length=config.matrix_config.chain_length,
            parallel=config.matrix_config.parallel,
            gpio_slowdown=config.matrix_config.gpio_slowdown,
            logo_variant=config.render_config.logo_variant,
            live_layout=config.render_config.live_layout
        )


class BaseDisplay(DisplayManager):
    """Base display implementation with common functionality."""

    def __init__(self, config: DeviceConfiguration):
        """
        Initialize base display.

        Args:
            config: Device configuration
        """
        self.config = config
        self.display_config = DisplayConfig.from_device_config(config)
        self.width = self.display_config.width
        self.height = self.display_config.height

        self._buffer = Image.new("RGB", (self.width, self.height))
        self._draw = ImageDraw.Draw(self._buffer)

        self._font_small = self._load_font(size=8)
        self._font_large = self._load_font(size=12)

        self._scene_manager = SceneManager()
        self._scene_manager.update_context(
            logo_variant=self.display_config.logo_variant,
            live_layout=self.display_config.live_layout
        )

        self._init_display()

    @abstractmethod
    def _init_display(self) -> None:
        """Initialize the specific display implementation."""
        pass

    @abstractmethod
    def _flush_display(self) -> None:
        """Flush buffer to the specific display implementation."""
        pass

    def _load_font(self, size: int) -> ImageFont.FreeTypeFont:
        """Load font for rendering."""
        try:
            return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size=size)
        except Exception:
            return ImageFont.load_default()

    def clear(self, color: Tuple[int, int, int] = (0, 0, 0)) -> None:
        """Clear the display buffer."""
        self._draw.rectangle((0, 0, self.width, self.height), fill=color)

    def render(self, snapshot: Optional[GameSnapshot], current_time: datetime) -> None:
        """
        Render content to the display.

        Args:
            snapshot: Game snapshot to render, or None for idle
            current_time: Current local time
        """
        self.clear((0, 0, 0))
        self._scene_manager.render_scene(
            buffer=self._buffer,
            draw=self._draw,
            snapshot=snapshot,
            current_time=current_time,
            font_small=self._font_small,
            font_large=self._font_large
        )

    def flush(self) -> None:
        """Flush the display buffer to hardware/output."""
        self._flush_display()

    def close(self) -> None:
        """Clean up display resources."""
        pass

    def update_configuration(self, config: DeviceConfiguration) -> None:
        """
        Update display configuration.

        Args:
            config: New device configuration
        """
        new_display_config = DisplayConfig.from_device_config(config)

        if (new_display_config.width != self.width or
            new_display_config.height != self.height):
            raise ValueError("Cannot update configuration with different dimensions")

        self.config = config
        self.display_config = new_display_config
        self._scene_manager.update_context(
            logo_variant=new_display_config.logo_variant,
            live_layout=new_display_config.live_layout
        )