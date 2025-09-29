"""
Concrete implementations of core interfaces.
"""

from datetime import datetime
from typing import Optional

from src.core.interfaces import ConfigurationProvider, GameProvider
from src.core.logging import get_logger
from src.config.supabase_config_loader import SupabaseConfigLoader, DeviceConfiguration
from src.model.game import GameSnapshot
from src.demo.simulator import DemoSimulator


logger = get_logger(__name__)


class SupabaseConfigurationProvider(ConfigurationProvider):
    """
    Configuration provider that wraps SupabaseConfigLoader.
    """

    def __init__(self, config_loader: SupabaseConfigLoader):
        """
        Initialize the provider.

        Args:
            config_loader: The SupabaseConfigLoader instance
        """
        self.config_loader = config_loader
        self._config: Optional[DeviceConfiguration] = None
        self._check_interval = 60  # seconds

    def load_configuration(self) -> DeviceConfiguration:
        """Load and return the device configuration."""
        logger.info("Loading configuration from Supabase")
        self._config = self.config_loader.load_full_config()
        logger.info(f"Loaded configuration for device {self._config.device_id}")
        return self._config

    def should_reload(self) -> bool:
        """Check if configuration should be reloaded."""
        return self.config_loader.should_refresh(self._check_interval)

    def reload(self) -> DeviceConfiguration:
        """Force reload of configuration."""
        logger.info("Reloading configuration from Supabase")
        self._config = self.config_loader.load_full_config()
        self.config_loader.update_heartbeat()
        logger.info("Configuration reloaded successfully")
        return self._config


class DemoGameProvider(GameProvider):
    """
    Game provider for demo mode.
    """

    def __init__(self, simulator: DemoSimulator):
        """
        Initialize the provider.

        Args:
            simulator: Demo simulator instance
        """
        self.simulator = simulator
        self._config: Optional[DeviceConfiguration] = None

    def get_current_game(self, current_time: datetime) -> Optional[GameSnapshot]:
        """Get the current game to display."""
        return self.simulator.get_snapshot(current_time)

    def configure(self, config: DeviceConfiguration) -> None:
        """Configure the provider with device settings."""
        self._config = config
        # Demo simulator is already configured in constructor


class LeagueAggregatorProvider(GameProvider):
    """
    Game provider that uses the league aggregator.
    """

    def __init__(self, aggregator):
        """
        Initialize the provider.

        Args:
            aggregator: LeagueAggregator instance
        """
        self.aggregator = aggregator
        self._config: Optional[DeviceConfiguration] = None

    def get_current_game(self, current_time: datetime) -> Optional[GameSnapshot]:
        """Get the current game to display."""
        if not self._config:
            logger.warning("LeagueAggregatorProvider not configured")
            return None

        try:
            # Build favorite teams dictionary
            favorite_teams = {}
            for league_code, teams in self._config.favorite_teams.items():
                favorite_teams[league_code] = [team.abbreviation for team in teams]

            snapshot = self.aggregator.get_featured_game(
                current_time.date(),
                current_time,
                favorite_teams
            )

            if snapshot:
                logger.debug(
                    f"Selected {snapshot.league.name} game: "
                    f"{snapshot.away.abbr} @ {snapshot.home.abbr}"
                )

            return snapshot

        except Exception as e:
            logger.error(f"Failed to get game from aggregator: {e}")
            return None

    def configure(self, config: DeviceConfiguration) -> None:
        """Configure the provider with device settings."""
        self._config = config
        # Aggregator configuration is handled separately