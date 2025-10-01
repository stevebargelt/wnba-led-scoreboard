"""
Scene registry for managing different display scenes.
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Dict, Optional, Type, Any

from PIL import Image, ImageDraw, ImageFont

from src.model.game import GameSnapshot


class Scene(ABC):
    """Abstract base class for display scenes."""

    @abstractmethod
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
        """
        Draw the scene to the buffer.

        Args:
            buffer: Image buffer to draw on
            draw: ImageDraw instance for the buffer
            snapshot: Game snapshot data
            current_time: Current local time
            font_small: Small font for text
            font_large: Large font for text
            **kwargs: Additional scene-specific parameters
        """
        pass

    @abstractmethod
    def get_name(self) -> str:
        """Get the scene name."""
        pass


class SceneRegistry:
    """Registry for managing available scenes."""

    def __init__(self):
        """Initialize the scene registry."""
        self._scenes: Dict[str, Type[Scene]] = {}
        self._instances: Dict[str, Scene] = {}

    def register(self, scene_class: Type[Scene], name: Optional[str] = None) -> None:
        """
        Register a scene class.

        Args:
            scene_class: The scene class to register
            name: Optional name override, defaults to class name
        """
        name = name or scene_class.__name__.lower().replace("scene", "")
        self._scenes[name] = scene_class

    def unregister(self, name: str) -> None:
        """
        Unregister a scene.

        Args:
            name: Name of the scene to unregister
        """
        if name in self._scenes:
            del self._scenes[name]
        if name in self._instances:
            del self._instances[name]

    def get_scene(self, name: str) -> Optional[Scene]:
        """
        Get a scene instance by name.

        Args:
            name: Name of the scene

        Returns:
            Scene instance or None if not found
        """
        if name not in self._instances and name in self._scenes:
            self._instances[name] = self._scenes[name]()

        return self._instances.get(name)

    def list_scenes(self) -> list[str]:
        """Get list of registered scene names."""
        return list(self._scenes.keys())

    def create_default_registry(self) -> 'SceneRegistry':
        """Create a registry with default scenes."""
        from src.display.scenes.builtin import (
            IdleScene,
            PregameScene,
            LiveScene,
            LiveBigScene,
            FinalScene
        )

        registry = SceneRegistry()
        registry.register(IdleScene, "idle")
        registry.register(PregameScene, "pregame")
        registry.register(LiveScene, "live")
        registry.register(LiveBigScene, "live_big")
        registry.register(FinalScene, "final")

        return registry