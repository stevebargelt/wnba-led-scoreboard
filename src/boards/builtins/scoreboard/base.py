"""
Base class for all sport-specific scoreboards.
"""

from abc import abstractmethod
from typing import Dict, Any
from PIL import Image, ImageDraw

from src.boards.base import BoardBase
from src.model.game import GameSnapshot, GameState


class BaseScoreboardBoard(BoardBase):
    """Base class for all sport scoreboards."""

    def should_display(self, context: Dict[str, Any]) -> bool:
        """
        Display scoreboard when there's an active game.

        Args:
            context: Runtime context

        Returns:
            True if there's a game to display
        """
        return context.get('game_snapshot') is not None

    def render(self,
               buffer: Image.Image,
               draw: ImageDraw.Draw,
               context: Dict[str, Any]) -> None:
        """
        Render the appropriate game state.

        Args:
            buffer: PIL Image buffer to render to
            draw: ImageDraw object for the buffer
            context: Runtime context including game snapshot
        """
        snapshot = context.get('game_snapshot')
        if not snapshot:
            self._render_no_game(buffer, draw, context)
            return

        # Route to appropriate render method based on game state
        if snapshot.state == GameState.PRE:
            self._render_pregame(buffer, draw, snapshot, context)
        elif snapshot.state == GameState.LIVE:
            self._render_live(buffer, draw, snapshot, context)
        elif snapshot.state == GameState.FINAL:
            self._render_final(buffer, draw, snapshot, context)
        else:
            # Unknown state, show final as fallback
            self._render_final(buffer, draw, snapshot, context)

    def _render_no_game(self,
                        buffer: Image.Image,
                        draw: ImageDraw.Draw,
                        context: Dict[str, Any]) -> None:
        """
        Render when no game is available.
        Default implementation shows nothing.

        Args:
            buffer: PIL Image buffer
            draw: ImageDraw object
            context: Runtime context
        """
        pass

    @abstractmethod
    def _render_pregame(self,
                        buffer: Image.Image,
                        draw: ImageDraw.Draw,
                        snapshot: GameSnapshot,
                        context: Dict[str, Any]) -> None:
        """
        Render pregame state.

        Args:
            buffer: PIL Image buffer
            draw: ImageDraw object
            snapshot: Current game snapshot
            context: Runtime context
        """
        pass

    @abstractmethod
    def _render_live(self,
                     buffer: Image.Image,
                     draw: ImageDraw.Draw,
                     snapshot: GameSnapshot,
                     context: Dict[str, Any]) -> None:
        """
        Render live game state.

        Args:
            buffer: PIL Image buffer
            draw: ImageDraw object
            snapshot: Current game snapshot
            context: Runtime context
        """
        pass

    @abstractmethod
    def _render_final(self,
                      buffer: Image.Image,
                      draw: ImageDraw.Draw,
                      snapshot: GameSnapshot,
                      context: Dict[str, Any]) -> None:
        """
        Render final/postgame state.

        Args:
            buffer: PIL Image buffer
            draw: ImageDraw object
            snapshot: Current game snapshot
            context: Runtime context
        """
        pass

    def get_refresh_rate(self) -> float:
        """
        Get refresh rate based on game state.
        Live games refresh faster than pregame/final.

        Returns:
            Refresh interval in seconds
        """
        # This will be overridden once we have context in the board
        # For now return default
        return super().get_refresh_rate()