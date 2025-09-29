"""
Adapter classes to bridge existing implementations with core interfaces.
"""

from datetime import datetime
from typing import Optional

from src.core.interfaces import DisplayManager, BoardProvider, RefreshManager
from src.core.logging import get_logger
from src.config.supabase_config_loader import DeviceConfiguration
from src.model.game import GameSnapshot
from src.render.renderer import Renderer
from src.boards.manager import BoardManager
from src.runtime.adaptive_refresh import AdaptiveRefreshManager
from PIL import Image, ImageDraw


logger = get_logger(__name__)


class RendererAdapter(DisplayManager):
    """
    Adapter to make Renderer class conform to DisplayManager interface.
    """

    def __init__(self, renderer: Renderer):
        """
        Initialize the adapter with a Renderer instance.

        Args:
            renderer: The Renderer instance to adapt
        """
        self.renderer = renderer

    def render(self, snapshot: Optional[GameSnapshot], current_time: datetime) -> None:
        """
        Render content to the display.

        Args:
            snapshot: Game snapshot to render, or None for idle
            current_time: Current local time
        """
        if snapshot is None:
            self.renderer.render_idle(current_time)
        elif snapshot.state.name.lower() == 'pre':
            self.renderer.render_pregame(snapshot, current_time)
        elif snapshot.state.name.lower() == 'live':
            self.renderer.render_live(snapshot, current_time)
        elif snapshot.state.name.lower() == 'final':
            self.renderer.render_final(snapshot, current_time)
        else:
            # Unknown state, render idle
            self.renderer.render_idle(current_time)

    def flush(self) -> None:
        """Flush the display buffer to hardware/output."""
        self.renderer.flush()

    def close(self) -> None:
        """Clean up display resources."""
        self.renderer.close()

    def update_configuration(self, config: DeviceConfiguration) -> None:
        """
        Update display configuration.

        Args:
            config: New device configuration
        """
        self.renderer.update_configuration(config)

    def get_buffer(self) -> Image:
        """
        Get the internal buffer for direct drawing.

        Returns:
            The PIL Image buffer
        """
        return self.renderer._buffer

    def get_draw(self) -> ImageDraw:
        """
        Get the ImageDraw instance for the buffer.

        Returns:
            The ImageDraw instance
        """
        return self.renderer._draw


class BoardManagerAdapter(BoardProvider):
    """
    Adapter to make BoardManager conform to BoardProvider interface.
    """

    def __init__(self, board_manager: BoardManager):
        """
        Initialize the adapter with a BoardManager instance.

        Args:
            board_manager: The BoardManager instance to adapt
        """
        self.board_manager = board_manager

    def get_next_board(self, context: dict) -> Optional[any]:
        """
        Select the next board to display based on context.

        Args:
            context: Current application context

        Returns:
            Board instance or None if no board should display
        """
        return self.board_manager.get_next_board(context)

    def render_current(self, buffer: Image, draw: ImageDraw) -> None:
        """
        Render the current board to the buffer.

        Args:
            buffer: Image buffer to render to
            draw: ImageDraw instance for the buffer
        """
        self.board_manager.render_current(buffer, draw)

    def get_refresh_rate(self) -> float:
        """
        Get the refresh rate for the current board.

        Returns:
            Refresh rate in seconds
        """
        return self.board_manager.get_current_refresh_rate()

    def transition_to(self, board) -> None:
        """
        Transition to a new board.

        Args:
            board: The board to transition to
        """
        self.board_manager.transition_to(board)

    @property
    def current_board(self):
        """Get the current board."""
        return self.board_manager.current_board


class AdaptiveRefreshAdapter(RefreshManager):
    """
    Adapter to make AdaptiveRefreshManager conform to RefreshManager interface.
    """

    def __init__(self, refresh_manager: AdaptiveRefreshManager):
        """
        Initialize the adapter with an AdaptiveRefreshManager instance.

        Args:
            refresh_manager: The AdaptiveRefreshManager instance to adapt
        """
        self.refresh_manager = refresh_manager

    def get_refresh_interval(
        self,
        snapshot: Optional[GameSnapshot],
        current_time: datetime
    ) -> float:
        """
        Calculate the appropriate refresh interval.

        Args:
            snapshot: Current game snapshot
            current_time: Current local time

        Returns:
            Refresh interval in seconds
        """
        return self.refresh_manager.get_refresh_interval(snapshot, current_time)

    def record_request_success(self) -> None:
        """Record successful data request."""
        self.refresh_manager.record_request_success()

    def record_request_failure(self) -> None:
        """Record failed data request."""
        self.refresh_manager.record_request_failure()