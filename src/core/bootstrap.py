"""
Bootstrap module for dependency injection and service registration.
"""

from typing import Optional

from src.core.container import ServiceContainer
from src.core.interfaces import (
    ConfigurationProvider,
    DisplayManager,
    BoardProvider,
    RefreshManager,
    GameProvider
)
from src.core.adapters import (
    RendererAdapter,
    BoardManagerAdapter,
    AdaptiveRefreshAdapter
)
from src.core.providers import (
    SupabaseConfigurationProvider,
    DemoGameProvider,
    LeagueAggregatorProvider
)
from src.core.logging import get_logger
from src.core.options import RuntimeOptions

from src.config.supabase_config_loader import SupabaseConfigLoader, DeviceConfiguration
from src.config.provider import (
    UnifiedConfigurationProvider,
    RuntimeConfigSource,
    EnvironmentConfigSource,
    SupabaseConfigSource,
    DefaultConfigSource
)
from src.config.models import ConfigurationValidator
from src.render.renderer import Renderer
from src.boards.manager import BoardManager
from src.runtime.adaptive_refresh import AdaptiveRefreshManager
from src.sports.league_aggregator import LeagueAggregator
from src.demo.simulator import DemoSimulator, parse_demo_options
from supabase import Client as SupabaseClient


logger = get_logger(__name__)


class ServiceBootstrap:
    """
    Bootstraps the application services and registers them in the DI container.
    """

    def __init__(self, container: ServiceContainer):
        """
        Initialize the bootstrap with a service container.

        Args:
            container: The DI container to register services in
        """
        self.container = container
        self._device_config: Optional[DeviceConfiguration] = None

    def bootstrap(
        self,
        options: RuntimeOptions,
        supabase_client: SupabaseClient,
        device_id: str
    ) -> DeviceConfiguration:
        """
        Bootstrap all application services.

        Args:
            options: Runtime options
            supabase_client: Supabase client instance
            device_id: Device ID

        Returns:
            The loaded DeviceConfiguration
        """
        logger.info("Bootstrapping application services")

        # 1. Set up unified configuration provider
        self._setup_unified_configuration(options, supabase_client, device_id)

        # 2. Register legacy configuration provider (for compatibility)
        config_loader = SupabaseConfigLoader(device_id, supabase_client)
        config_provider = SupabaseConfigurationProvider(config_loader)
        self.container.register(ConfigurationProvider, config_provider)
        logger.debug("Registered ConfigurationProvider")

        # 3. Load initial configuration
        self._device_config = config_provider.load_configuration()
        logger.info(f"Loaded configuration for device {self._device_config.device_id}")

        # 4. Update unified configuration with Supabase data
        if hasattr(self, '_supabase_source'):
            self._supabase_source.update(self._device_config)
            logger.debug("Updated unified configuration with Supabase data")

        # 3. Register display manager (Renderer with adapter)
        renderer = Renderer(self._device_config, force_sim=options.is_simulation)
        display_manager = RendererAdapter(renderer)
        self.container.register(DisplayManager, display_manager)
        logger.debug("Registered DisplayManager")

        # 4. Register board provider (BoardManager with adapter)
        board_manager = BoardManager(self._device_config)
        board_provider = BoardManagerAdapter(board_manager)
        self.container.register(BoardProvider, board_provider)
        logger.debug("Registered BoardProvider")

        # 5. Register refresh manager
        adaptive_refresh = AdaptiveRefreshManager(self._device_config.refresh_config)
        refresh_manager = AdaptiveRefreshAdapter(adaptive_refresh)
        self.container.register(RefreshManager, refresh_manager)
        logger.debug("Registered RefreshManager")

        # 6. Register game provider (demo or league aggregator based on mode)
        if options.is_demo:
            self._register_demo_provider(options)
        else:
            self._register_league_provider()

        logger.info("Service bootstrap complete")
        return self._device_config

    def _setup_unified_configuration(
        self,
        options: RuntimeOptions,
        supabase_client: SupabaseClient,
        device_id: str
    ) -> None:
        """
        Set up the unified configuration provider.

        Args:
            options: Runtime options
            supabase_client: Supabase client instance
            device_id: Device ID
        """
        # Create configuration sources with proper precedence
        sources = []

        # 1. Default configuration (lowest priority)
        sources.append(DefaultConfigSource())

        # 2. Supabase configuration (medium priority)
        # Will be populated after loading from Supabase
        self._supabase_source = SupabaseConfigSource()
        sources.append(self._supabase_source)

        # 3. Environment variables (high priority)
        sources.append(EnvironmentConfigSource())

        # 4. Runtime options (highest priority)
        runtime_config = {
            "simulation_mode": options.is_simulation,
            "demo_mode": options.is_demo,
            "run_once": options.run_once,
        }
        if options.demo_leagues:
            runtime_config["demo_leagues"] = options.demo_leagues
        if options.demo_rotation_seconds:
            runtime_config["demo_rotation_seconds"] = options.demo_rotation_seconds

        sources.append(RuntimeConfigSource(runtime_config))

        # Create unified provider
        self._unified_config = UnifiedConfigurationProvider(sources)
        logger.debug("Created unified configuration provider with 4 sources")

    def _register_demo_provider(self, options: RuntimeOptions) -> None:
        """
        Register demo game provider.

        Args:
            options: Runtime options with demo configuration
        """
        demo_options = parse_demo_options(
            forced_leagues=options.demo_leagues,
            rotation_seconds=options.demo_rotation_seconds
        )
        simulator = DemoSimulator(self._device_config, options=demo_options)
        game_provider = DemoGameProvider(simulator)
        self.container.register(GameProvider, game_provider)
        logger.info(f"Registered DemoGameProvider with leagues: {options.demo_leagues or 'All'}")

    def _register_league_provider(self) -> None:
        """Register league aggregator game provider."""
        aggregator = LeagueAggregator(
            self._device_config.league_priorities,
            self._device_config.enabled_leagues
        )
        aggregator.configure_priority_rules(
            live_game_boost=True,
            favorite_team_boost=True,
            close_game_boost=True,
            playoff_boost=True,
            conflict_resolution='priority'
        )
        game_provider = LeagueAggregatorProvider(aggregator)
        game_provider.configure(self._device_config)
        self.container.register(GameProvider, game_provider)
        logger.info(f"Registered LeagueAggregatorProvider with leagues: {self._device_config.enabled_leagues}")

    def update_configuration(self, new_config: DeviceConfiguration, options: RuntimeOptions) -> None:
        """
        Update services with new configuration.

        Args:
            new_config: New device configuration
            options: Runtime options
        """
        logger.info("Updating services with new configuration")

        # Check if display needs resize
        resized = (
            new_config.matrix_config.width != self._device_config.matrix_config.width or
            new_config.matrix_config.height != self._device_config.matrix_config.height
        )

        self._device_config = new_config

        # Update or recreate display manager
        if resized:
            logger.info("Display size changed, recreating DisplayManager")
            # Close existing display
            try:
                display_manager = self.container.resolve(DisplayManager)
                display_manager.close()
            except Exception as e:
                logger.warning(f"Error closing display: {e}")

            # Create new renderer and adapter
            renderer = Renderer(new_config, force_sim=options.is_simulation)
            display_manager = RendererAdapter(renderer)
            self.container.register(DisplayManager, display_manager)
        else:
            # Just update configuration
            display_manager = self.container.resolve(DisplayManager)
            display_manager.update_configuration(new_config)

        # Recreate board manager (always)
        board_manager = BoardManager(new_config)
        board_provider = BoardManagerAdapter(board_manager)
        self.container.register(BoardProvider, board_provider)

        # Recreate refresh manager
        adaptive_refresh = AdaptiveRefreshManager(new_config.refresh_config)
        refresh_manager = AdaptiveRefreshAdapter(adaptive_refresh)
        self.container.register(RefreshManager, refresh_manager)

        # Update game provider if not in demo mode
        if not options.is_demo:
            self._register_league_provider()

        logger.info("Service update complete")