"""
Scene manager for coordinating scene selection and rendering.
"""

from datetime import datetime
from typing import Optional, Dict, Any

from PIL import Image, ImageDraw, ImageFont

from src.model.game import GameSnapshot, GameState
from src.core.logging import get_logger
from .registry import SceneRegistry, Scene

logger = get_logger(__name__)


class SceneManager:
    """Manages scene selection and rendering."""

    def __init__(self, registry: Optional[SceneRegistry] = None):
        """
        Initialize scene manager.

        Args:
            registry: Scene registry to use, creates default if None
        """
        self.registry = registry or SceneRegistry().create_default_registry()
        self.current_scene: Optional[Scene] = None
        self.scene_context: Dict[str, Any] = {}

    def select_scene(self, snapshot: Optional[GameSnapshot]) -> Optional[Scene]:
        """
        Select appropriate scene based on game state.

        Args:
            snapshot: Current game snapshot

        Returns:
            Selected scene or None
        """
        scene_name = self._determine_scene_name(snapshot)
        scene = self.registry.get_scene(scene_name)

        if scene != self.current_scene:
            logger.debug(f"Scene changed: {self.current_scene} -> {scene}")
            self.current_scene = scene
            self._on_scene_change(scene)

        return scene

    def _determine_scene_name(self, snapshot: Optional[GameSnapshot]) -> str:
        """
        Determine scene name based on game state.

        Args:
            snapshot: Current game snapshot

        Returns:
            Scene name
        """
        if snapshot is None:
            return "idle"

        if snapshot.state == GameState.PRE:
            return "pregame"
        elif snapshot.state == GameState.LIVE:
            live_layout = self.scene_context.get("live_layout", "stacked")
            if live_layout.lower() == "big-logos":
                return "live_big"
            return "live"
        elif snapshot.state == GameState.FINAL:
            return "final"
        else:
            return "idle"

    def render_scene(
        self,
        buffer: Image.Image,
        draw: ImageDraw.ImageDraw,
        snapshot: Optional[GameSnapshot],
        current_time: datetime,
        font_small: ImageFont.FreeTypeFont,
        font_large: ImageFont.FreeTypeFont
    ) -> None:
        """
        Render the current scene.

        Args:
            buffer: Image buffer to draw on
            draw: ImageDraw instance
            snapshot: Current game snapshot
            current_time: Current local time
            font_small: Small font
            font_large: Large font
        """
        scene = self.select_scene(snapshot)
        if scene:
            try:
                scene.draw(
                    buffer=buffer,
                    draw=draw,
                    snapshot=snapshot,
                    current_time=current_time,
                    font_small=font_small,
                    font_large=font_large,
                    **self.scene_context
                )
            except Exception as e:
                logger.error(f"Failed to render scene {scene.get_name()}: {e}")
                self._render_error_scene(draw, font_small)

    def _render_error_scene(self, draw: ImageDraw.ImageDraw, font: ImageFont.FreeTypeFont) -> None:
        """Render error message when scene fails."""
        draw.text((1, 1), "Scene Error", fill=(255, 0, 0), font=font)

    def _on_scene_change(self, new_scene: Optional[Scene]) -> None:
        """Handle scene change event."""
        if new_scene:
            logger.info(f"Scene activated: {new_scene.get_name()}")

    def update_context(self, **kwargs: Any) -> None:
        """
        Update scene context parameters.

        Args:
            **kwargs: Context parameters to update
        """
        self.scene_context.update(kwargs)

    def get_current_scene_name(self) -> Optional[str]:
        """Get current scene name."""
        return self.current_scene.get_name() if self.current_scene else None

    def get_available_scenes(self) -> list[str]:
        """Get list of available scene names."""
        return self.registry.list_scenes()