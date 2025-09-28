"""
Abstract base class for all display boards.
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from PIL import Image, ImageDraw
from datetime import datetime


class BoardBase(ABC):
    """Abstract base class for all display boards."""

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize board with configuration.

        Args:
            config: Board-specific configuration dictionary
        """
        self.config = config
        self.enabled = config.get('enabled', True)
        self.priority = config.get('priority', 0)
        self.duration = config.get('duration', 10)  # seconds
        self.name = self.__class__.__name__

    @abstractmethod
    def render(self,
               buffer: Image.Image,
               draw: ImageDraw.Draw,
               context: Dict[str, Any]) -> None:
        """
        Render the board content to the buffer.

        Args:
            buffer: PIL Image buffer to render to
            draw: ImageDraw object for the buffer
            context: Runtime context including game state, time, etc.
        """
        pass

    @abstractmethod
    def should_display(self, context: Dict[str, Any]) -> bool:
        """
        Determine if this board should be displayed given the context.

        Args:
            context: Runtime context including game state, time, etc.

        Returns:
            True if this board should be displayed, False otherwise
        """
        pass

    def update(self, context: Dict[str, Any]) -> None:
        """
        Update board state with new context data.
        Called before render to allow data fetching/updates.

        Args:
            context: Runtime context including game state, time, etc.
        """
        pass

    def on_enter(self) -> None:
        """
        Called when this board becomes active.
        Use for initialization, starting animations, etc.
        """
        pass

    def on_exit(self) -> None:
        """
        Called when switching away from this board.
        Use for cleanup, saving state, etc.
        """
        pass

    def handle_input(self, input_type: str, data: Any = None) -> bool:
        """
        Handle user input events.

        Args:
            input_type: Type of input (e.g., 'button_press', 'gesture')
            data: Additional input data

        Returns:
            True if input was handled, False otherwise
        """
        return False

    def get_refresh_rate(self) -> float:
        """
        Get the desired refresh rate for this board in seconds.

        Returns:
            Refresh interval in seconds (default from duration config)
        """
        return self.config.get('refresh_rate', 1.0)

    def __str__(self) -> str:
        """String representation of the board."""
        return f"{self.name}(priority={self.priority}, enabled={self.enabled})"

    def __repr__(self) -> str:
        """Developer representation of the board."""
        return f"<{self.name} priority={self.priority} enabled={self.enabled} at {hex(id(self))}>"