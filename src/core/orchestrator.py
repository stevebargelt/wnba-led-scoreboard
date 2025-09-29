"""
Main application orchestrator that coordinates all components.
"""

import signal
import time
from datetime import datetime
from typing import Optional, Dict, List

from src.core.logging import get_logger
from src.core.interfaces import (
    ConfigurationProvider,
    GameProvider,
    DisplayManager,
    BoardProvider,
    RefreshManager,
    ApplicationContext,
    ApplicationLifecycle
)
from src.core.options import RuntimeOptions
from src.config.supabase_config_loader import DeviceConfiguration, TeamInfo
from src.model.game import GameSnapshot
from src.demo.simulator import DemoSimulator, parse_demo_options
from src.sports.league_aggregator import LeagueAggregator
from src.runtime.adaptive_refresh import AdaptiveRefreshManager
from src.boards.manager import BoardManager
from src.render.renderer import Renderer


logger = get_logger(__name__)


class ApplicationOrchestrator:
    """
    Orchestrates the main application loop and component coordination.
    """

    def __init__(
        self,
        config_provider: ConfigurationProvider,
        options: RuntimeOptions
    ):
        """
        Initialize the orchestrator.

        Args:
            config_provider: Configuration provider instance
            options: Runtime options
        """
        self.config_provider = config_provider
        self.options = options
        self.device_config: Optional[DeviceConfiguration] = None
        self.reload_requested = False

        # Components (initialized in setup)
        self.game_provider: Optional[GameProvider] = None
        self.display_manager: Optional[DisplayManager] = None
        self.board_manager: Optional[BoardManager] = None
        self.refresh_manager: Optional[RefreshManager] = None
        self.aggregator: Optional[LeagueAggregator] = None

        # Lifecycle hooks
        self.lifecycle_hooks: List[ApplicationLifecycle] = []

        # Setup signal handlers
        self._setup_signal_handlers()

        logger.info("ApplicationOrchestrator initialized")

    def _setup_signal_handlers(self):
        """Setup signal handlers for configuration reload."""
        signal.signal(signal.SIGHUP, self._signal_reload)
        # Allow SIGUSR1 as alternative on some systems
        try:
            signal.signal(signal.SIGUSR1, self._signal_reload)
        except Exception:
            pass

    def _signal_reload(self, signum, frame):
        """Handle reload signal."""
        logger.info(f"Received reload signal {signum}")
        self.reload_requested = True

    def setup(self) -> None:
        """
        Setup all components before running.
        """
        logger.info("Setting up application components")

        # Load initial configuration
        self.device_config = self.config_provider.load_configuration()
        logger.info(f"Loaded configuration for device {self.device_config.device_id}")

        # Initialize display manager (renderer)
        self.display_manager = Renderer(self.device_config, force_sim=self.options.is_simulation)
        logger.info(f"Display manager initialized (simulation={self.options.is_simulation})")

        # Initialize board manager
        self.board_manager = BoardManager(self.device_config)
        logger.info(f"Board manager initialized with {len(self.board_manager.boards)} boards")

        # Setup game provider based on mode
        if self.options.is_demo:
            self._setup_demo_provider()
        else:
            self._setup_league_aggregator()

        # Initialize refresh manager
        self.refresh_manager = AdaptiveRefreshManager(self.device_config.refresh_config)
        logger.info("Refresh manager initialized")

        # Notify lifecycle hooks
        for hook in self.lifecycle_hooks:
            hook.on_startup()

    def _setup_demo_provider(self):
        """Setup demo mode provider."""
        demo_options = parse_demo_options(
            forced_leagues=self.options.demo_leagues,
            rotation_seconds=self.options.demo_rotation_seconds
        )
        # Store as both game_provider and specific type for demo mode
        self.game_provider = DemoSimulator(self.device_config, options=demo_options)
        logger.info(f"Demo mode enabled with leagues: {self.options.demo_leagues or 'All'}")

    def _setup_league_aggregator(self):
        """Setup league aggregator for production mode."""
        self.aggregator = LeagueAggregator(
            self.device_config.league_priorities,
            self.device_config.enabled_leagues
        )
        self.aggregator.configure_priority_rules(
            live_game_boost=True,
            favorite_team_boost=True,
            close_game_boost=True,
            playoff_boost=True,
            conflict_resolution='priority'
        )
        logger.info(f"League aggregator setup with leagues: {self.device_config.enabled_leagues}")

    def run(self) -> int:
        """
        Run the main application loop.

        Returns:
            Exit code (0 for success)
        """
        try:
            self.setup()
            logger.info("Starting main application loop")
            self._main_loop()
            return 0

        except KeyboardInterrupt:
            logger.info("Application interrupted by user")
            return 0

        except Exception as e:
            logger.error(f"Fatal error in orchestrator: {e}", exc_info=True)
            return 1

        finally:
            self.cleanup()

    def _main_loop(self):
        """Main application loop."""
        while True:
            try:
                # Get current time
                now_local = datetime.now(self.device_config.tz)

                # Get game snapshot
                snapshot = self._get_game_snapshot(now_local)

                # Build context for boards
                context = self._build_context(snapshot, now_local)

                # Render current state
                self._render(context, snapshot, now_local)

                # Check for configuration reload
                if self._should_reload_config():
                    self._reload_configuration()

                # Check if we should exit
                if self.options.run_once:
                    logger.info("Run once mode - exiting")
                    break

                # Calculate sleep interval
                sleep_interval = self._get_sleep_interval(snapshot, now_local)
                logger.debug(f"Sleeping for {sleep_interval:.1f} seconds")
                time.sleep(sleep_interval)

            except Exception as e:
                logger.error(f"Error in main loop: {e}", exc_info=True)
                # Let lifecycle hooks decide if we should continue
                context = self._build_context(None, datetime.now(self.device_config.tz))
                should_continue = all(
                    hook.on_error(e, context) for hook in self.lifecycle_hooks
                )
                if not should_continue:
                    logger.error("Lifecycle hooks requested shutdown")
                    break
                # Sleep a bit before retrying
                time.sleep(5)

    def _get_game_snapshot(self, now_local: datetime) -> Optional[GameSnapshot]:
        """Get current game snapshot."""
        if self.options.is_demo and isinstance(self.game_provider, DemoSimulator):
            # Demo mode - DemoSimulator has different method signature
            return self.game_provider.get_snapshot(now_local)

        elif self.aggregator:
            # Production mode with aggregator
            try:
                # Build favorite teams dictionary
                favorite_teams = {}
                if self.device_config:
                    for league_code, teams in self.device_config.favorite_teams.items():
                        favorite_teams[league_code] = [team.abbreviation for team in teams]

                snapshot = self.aggregator.get_featured_game(
                    now_local.date(),
                    now_local,
                    favorite_teams
                )

                if snapshot:
                    logger.info(
                        f"Selected {snapshot.league.name} game: "
                        f"{snapshot.away.abbr} @ {snapshot.home.abbr}"
                    )

                self.refresh_manager.record_request_success()
                return snapshot

            except Exception as e:
                logger.warning(f"League aggregation failed: {e}")
                self.refresh_manager.record_request_failure()
                return None

        return None

    def _build_context(self, snapshot: Optional[GameSnapshot], now_local: datetime) -> Dict:
        """Build context for board selection and rendering."""
        favorite_teams = {}
        if self.device_config:
            for league_code, teams in self.device_config.favorite_teams.items():
                favorite_teams[league_code] = [team.abbreviation for team in teams]

        return {
            'game_snapshot': snapshot,
            'current_time': now_local,
            'state': 'idle' if snapshot is None else snapshot.state.name.lower(),
            'favorite_teams': favorite_teams,
            'device_config': self.device_config,
        }

    def _render(self, context: Dict, snapshot: Optional[GameSnapshot], now_local: datetime):
        """Render the current state."""
        # Select and render board
        next_board = self.board_manager.get_next_board(context)
        if next_board:
            # Transition to new board if needed
            if next_board != self.board_manager.current_board:
                self.board_manager.transition_to(next_board)
            # Render the board
            self.board_manager.render_current(
                self.display_manager._buffer,
                self.display_manager._draw
            )
        else:
            # No board wants to display, show idle
            self.display_manager.render_idle(now_local)

        # Flush to display
        self.display_manager.flush()

    def _get_sleep_interval(self, snapshot: Optional[GameSnapshot], now_local: datetime) -> float:
        """Calculate sleep interval based on current state."""
        # Use board's refresh rate if available
        if self.board_manager.current_board:
            return self.board_manager.get_current_refresh_rate()

        # Otherwise use adaptive refresh
        return self.refresh_manager.get_refresh_interval(snapshot, now_local)

    def _should_reload_config(self) -> bool:
        """Check if configuration should be reloaded."""
        return (
            self.config_provider.should_reload() or
            self.reload_requested
        )

    def _reload_configuration(self):
        """Reload configuration from provider."""
        try:
            logger.info("Reloading configuration")
            old_config = self.device_config
            new_config = self.config_provider.reload()

            # Check if display needs resize
            resized = (
                new_config.matrix_config.width != old_config.matrix_config.width or
                new_config.matrix_config.height != old_config.matrix_config.height
            )

            # Update configuration
            self.device_config = new_config

            # Handle display resize if needed
            if resized:
                logger.info("Display size changed, recreating renderer")
                try:
                    self.display_manager.close()
                except Exception:
                    pass
                self.display_manager = Renderer(new_config, force_sim=self.options.is_simulation)
            else:
                self.display_manager.update_configuration(new_config)

            # Reinitialize components
            if not self.options.is_demo and self.aggregator:
                self.aggregator = LeagueAggregator(
                    new_config.league_priorities,
                    new_config.enabled_leagues
                )
                self.aggregator.configure_priority_rules(
                    live_game_boost=True,
                    favorite_team_boost=True,
                    close_game_boost=True,
                    playoff_boost=True,
                    conflict_resolution='priority'
                )

            # Reinitialize board manager
            self.board_manager = BoardManager(new_config)

            # Reinitialize refresh manager
            self.refresh_manager = AdaptiveRefreshManager(new_config.refresh_config)

            # Clear reload flag
            self.reload_requested = False

            # Notify lifecycle hooks
            for hook in self.lifecycle_hooks:
                hook.on_config_reload(old_config, new_config)

            logger.info("Configuration reloaded successfully")

        except Exception as e:
            logger.error(f"Failed to reload configuration: {e}", exc_info=True)
            # Note: reload_requested stays True so we'll retry

    def cleanup(self):
        """Cleanup resources before shutdown."""
        logger.info("Cleaning up resources")

        # Notify lifecycle hooks
        for hook in self.lifecycle_hooks:
            try:
                hook.on_shutdown()
            except Exception as e:
                logger.error(f"Error in lifecycle hook shutdown: {e}")

        # Close display
        if self.display_manager:
            try:
                self.display_manager.close()
            except Exception as e:
                logger.error(f"Error closing display: {e}")

        logger.info("Cleanup complete")

    def register_lifecycle_hook(self, hook: ApplicationLifecycle):
        """
        Register a lifecycle hook.

        Args:
            hook: Lifecycle hook to register
        """
        self.lifecycle_hooks.append(hook)
        logger.debug(f"Registered lifecycle hook: {hook.__class__.__name__}")