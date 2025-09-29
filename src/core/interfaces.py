"""
Core interfaces and abstract base classes for the LED Scoreboard application.
"""

from abc import ABC, abstractmethod
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from dataclasses import dataclass

from src.model.game import GameSnapshot
from src.config.supabase_config_loader import DeviceConfiguration
from PIL import Image, ImageDraw


class ConfigurationProvider(ABC):
    """Abstract interface for configuration providers."""

    @abstractmethod
    def load_configuration(self) -> DeviceConfiguration:
        """Load and return the device configuration."""
        pass

    @abstractmethod
    def should_reload(self) -> bool:
        """Check if configuration should be reloaded."""
        pass

    @abstractmethod
    def reload(self) -> DeviceConfiguration:
        """Force reload of configuration."""
        pass


class GameProvider(ABC):
    """Abstract interface for game data providers."""

    @abstractmethod
    def get_current_game(self, current_time: datetime) -> Optional[GameSnapshot]:
        """
        Get the current game to display.

        Args:
            current_time: Current local time

        Returns:
            GameSnapshot if a game should be displayed, None otherwise
        """
        pass

    @abstractmethod
    def configure(self, config: DeviceConfiguration) -> None:
        """
        Configure the provider with device settings.

        Args:
            config: Device configuration
        """
        pass


class DisplayManager(ABC):
    """Abstract interface for display management."""

    @abstractmethod
    def render(self, snapshot: Optional[GameSnapshot], current_time: datetime) -> None:
        """
        Render content to the display.

        Args:
            snapshot: Game snapshot to render, or None for idle
            current_time: Current local time
        """
        pass

    @abstractmethod
    def flush(self) -> None:
        """Flush the display buffer to hardware/output."""
        pass

    @abstractmethod
    def close(self) -> None:
        """Clean up display resources."""
        pass

    @abstractmethod
    def update_configuration(self, config: DeviceConfiguration) -> None:
        """
        Update display configuration.

        Args:
            config: New device configuration
        """
        pass


class BoardProvider(ABC):
    """Abstract interface for board selection and management."""

    @abstractmethod
    def get_next_board(self, context: Dict[str, Any]) -> Optional[Any]:
        """
        Select the next board to display based on context.

        Args:
            context: Current application context

        Returns:
            Board instance or None if no board should display
        """
        pass

    @abstractmethod
    def render_current(self, buffer: Image, draw: ImageDraw) -> None:
        """
        Render the current board to the buffer.

        Args:
            buffer: Image buffer to render to
            draw: ImageDraw instance for the buffer
        """
        pass

    @abstractmethod
    def get_refresh_rate(self) -> float:
        """
        Get the refresh rate for the current board.

        Returns:
            Refresh rate in seconds
        """
        pass


class RefreshManager(ABC):
    """Abstract interface for adaptive refresh management."""

    @abstractmethod
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
        pass

    @abstractmethod
    def record_request_success(self) -> None:
        """Record successful data request."""
        pass

    @abstractmethod
    def record_request_failure(self) -> None:
        """Record failed data request."""
        pass


@dataclass
class ApplicationContext:
    """Context passed between application components."""

    device_config: DeviceConfiguration
    current_time: datetime
    game_snapshot: Optional[GameSnapshot]
    favorite_teams: Dict[str, List[str]]
    state: str
    reload_requested: bool = False


class ApplicationLifecycle(ABC):
    """Interface for application lifecycle hooks."""

    @abstractmethod
    def on_startup(self) -> None:
        """Called when application starts."""
        pass

    @abstractmethod
    def on_shutdown(self) -> None:
        """Called when application is shutting down."""
        pass

    @abstractmethod
    def on_config_reload(self, old_config: DeviceConfiguration, new_config: DeviceConfiguration) -> None:
        """
        Called when configuration is reloaded.

        Args:
            old_config: Previous configuration
            new_config: New configuration
        """
        pass

    @abstractmethod
    def on_error(self, error: Exception, context: ApplicationContext) -> bool:
        """
        Called when an error occurs.

        Args:
            error: The exception that occurred
            context: Current application context

        Returns:
            True to continue, False to shutdown
        """
        pass