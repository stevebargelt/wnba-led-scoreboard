"""
Mock display implementation for testing.
"""

from datetime import datetime
from typing import Optional, List, Tuple, Any

from PIL import Image

from src.config.supabase_config_loader import DeviceConfiguration
from src.model.game import GameSnapshot
from .base import BaseDisplay


class MockDisplay(BaseDisplay):
    """Mock display implementation for testing."""

    def __init__(self, config: DeviceConfiguration):
        """
        Initialize mock display.

        Args:
            config: Device configuration
        """
        self.render_calls: List[Tuple[Optional[GameSnapshot], datetime]] = []
        self.flush_calls: int = 0
        self.close_calls: int = 0
        self.config_updates: List[DeviceConfiguration] = []
        self.last_buffer_content: Optional[Image.Image] = None
        self.fail_on_flush: bool = False
        self.fail_on_render: bool = False
        super().__init__(config)

    def _init_display(self) -> None:
        """Initialize the mock display."""
        pass

    def _flush_display(self) -> None:
        """Mock flush operation."""
        if self.fail_on_flush:
            raise RuntimeError("Mock flush failure")

        self.flush_calls += 1
        self.last_buffer_content = self._buffer.copy()

    def render(self, snapshot: Optional[GameSnapshot], current_time: datetime) -> None:
        """
        Mock render operation.

        Args:
            snapshot: Game snapshot to render
            current_time: Current local time
        """
        if self.fail_on_render:
            raise RuntimeError("Mock render failure")

        self.render_calls.append((snapshot, current_time))
        super().render(snapshot, current_time)

    def close(self) -> None:
        """Mock close operation."""
        self.close_calls += 1
        super().close()

    def update_configuration(self, config: DeviceConfiguration) -> None:
        """
        Mock configuration update.

        Args:
            config: New device configuration
        """
        self.config_updates.append(config)
        super().update_configuration(config)

    def get_render_count(self) -> int:
        """Get the number of render calls."""
        return len(self.render_calls)

    def get_last_render(self) -> Optional[Tuple[Optional[GameSnapshot], datetime]]:
        """Get the last render call details."""
        return self.render_calls[-1] if self.render_calls else None

    def reset_mock(self) -> None:
        """Reset all mock tracking."""
        self.render_calls.clear()
        self.flush_calls = 0
        self.close_calls = 0
        self.config_updates.clear()
        self.last_buffer_content = None
        self.fail_on_flush = False
        self.fail_on_render = False

    def set_failure_mode(self, fail_on_flush: bool = False, fail_on_render: bool = False) -> None:
        """
        Configure mock to fail on certain operations.

        Args:
            fail_on_flush: If True, flush will raise an exception
            fail_on_render: If True, render will raise an exception
        """
        self.fail_on_flush = fail_on_flush
        self.fail_on_render = fail_on_render

    def get_buffer_pixel(self, x: int, y: int) -> Tuple[int, int, int]:
        """
        Get pixel value from the buffer.

        Args:
            x: X coordinate
            y: Y coordinate

        Returns:
            RGB tuple
        """
        if self.last_buffer_content:
            return self.last_buffer_content.getpixel((x, y))
        return (0, 0, 0)

    def assert_text_rendered(self, text: str) -> bool:
        """
        Check if text was rendered (simplified check).

        Args:
            text: Text to check for

        Returns:
            True if any render call included the text
        """
        return any(text in str(call) for call in self.render_calls)