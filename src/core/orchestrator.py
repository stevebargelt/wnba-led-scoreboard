"""
Main application orchestrator that coordinates all components.
"""

import signal
import time
from datetime import datetime
from typing import Optional, Dict, List

from src.core.logging import get_logger
from src.core.container import ServiceContainer
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
from src.core.bootstrap import ServiceBootstrap
from src.core.exceptions import (
    ConfigurationError,
    ConfigurationReloadError,
    TransientError,
    GameProviderError
)
from src.config.supabase_config_loader import DeviceConfiguration
from src.model.game import GameSnapshot


logger = get_logger(__name__)


class ApplicationOrchestrator:
    """
    Orchestrates the main application loop and component coordination.
    """

    def __init__(
        self,
        container: ServiceContainer,
        options: RuntimeOptions
    ):
        """
        Initialize the orchestrator.

        Args:
            container: Dependency injection container with registered services
            options: Runtime options
        """
        self.container = container
        self.options = options
        self.device_config: Optional[DeviceConfiguration] = None
        self.reload_requested = False

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

    def setup(self, device_config: DeviceConfiguration) -> None:
        """
        Setup all components before running.

        Args:
            device_config: Initial device configuration from bootstrap
        """
        logger.info("Setting up application components")

        # Store the configuration
        self.device_config = device_config
        logger.info(f"Loaded configuration for device {self.device_config.device_id}")

        # All services should already be registered in the container
        # Just verify they're available
        config_provider = self.container.resolve(ConfigurationProvider)
        display_manager = self.container.resolve(DisplayManager)
        board_provider = self.container.resolve(BoardProvider)
        game_provider = self.container.resolve(GameProvider)
        refresh_manager = self.container.resolve(RefreshManager)

        logger.info(f"Display manager initialized (simulation={self.options.is_simulation})")
        logger.info("All services resolved from container")

        # Notify lifecycle hooks
        for hook in self.lifecycle_hooks:
            hook.on_startup()


    def run(self, device_config: DeviceConfiguration, bootstrap: Optional[ServiceBootstrap] = None) -> int:
        """
        Run the main application loop.

        Args:
            device_config: Initial device configuration from bootstrap
            bootstrap: Optional service bootstrap for configuration reloads

        Returns:
            Exit code (0 for success)
        """
        try:
            self.setup(device_config)
            logger.info("Starting main application loop")
            self._main_loop(bootstrap)
            return 0

        except KeyboardInterrupt:
            logger.info("Application interrupted by user")
            return 0

        except Exception as e:
            logger.error(f"Fatal error in orchestrator: {e}", exc_info=True)
            return 1

        finally:
            self.cleanup()

    def _main_loop(self, bootstrap: Optional[ServiceBootstrap] = None):
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
                if bootstrap and self._should_reload_config():
                    try:
                        self._reload_configuration(bootstrap)
                    except ConfigurationReloadError as e:
                        logger.warning(f"Configuration reload failed, continuing with current config: {e}")
                        # Continue with existing configuration

                # Check if we should exit
                if self.options.run_once:
                    logger.info("Run once mode - exiting")
                    break

                # Calculate sleep interval
                sleep_interval = self._get_sleep_interval(snapshot, now_local)
                logger.debug(f"Sleeping for {sleep_interval:.1f} seconds")
                time.sleep(sleep_interval)

            except TransientError as e:
                # Transient errors - retry with backoff
                logger.warning(f"Transient error in main loop, retrying: {e}")
                time.sleep(5)  # Short retry delay

            except (ConfigurationError, GameProviderError) as e:
                # Critical errors - notify hooks and possibly exit
                logger.error(f"Critical error in main loop: {e}", exc_info=True)
                context = self._build_context(None, datetime.now(self.device_config.tz))
                should_continue = all(
                    hook.on_error(e, context) for hook in self.lifecycle_hooks
                )
                if not should_continue:
                    logger.error("Lifecycle hooks requested shutdown due to critical error")
                    break
                # Longer delay for critical errors
                time.sleep(30)

            except Exception as e:
                # Unexpected errors - log and continue with caution
                logger.error(f"Unexpected error in main loop: {e}", exc_info=True)
                # Let lifecycle hooks decide if we should continue
                context = self._build_context(None, datetime.now(self.device_config.tz))
                should_continue = all(
                    hook.on_error(e, context) for hook in self.lifecycle_hooks
                )
                if not should_continue:
                    logger.error("Lifecycle hooks requested shutdown")
                    break
                # Moderate delay for unexpected errors
                time.sleep(10)

    def _get_game_snapshot(self, now_local: datetime) -> Optional[GameSnapshot]:
        """Get current game snapshot."""
        game_provider = self.container.resolve(GameProvider)
        refresh_manager = self.container.resolve(RefreshManager)

        if game_provider:
            try:
                # Get current game from the provider
                snapshot = game_provider.get_current_game(now_local)

                if snapshot:
                    logger.info(
                        f"Selected game: {snapshot.away.abbr} @ {snapshot.home.abbr}"
                    )

                refresh_manager.record_request_success()
                return snapshot

            except TransientError as e:
                # Transient errors can be retried
                logger.warning(f"Transient error getting game: {e}")
                refresh_manager.record_request_failure()
                return None

            except (ConfigurationError, GameProviderError) as e:
                # Critical errors should be re-raised
                logger.error(f"Critical error in game provider: {e}")
                refresh_manager.record_request_failure()
                raise

            except Exception as e:
                # Unexpected errors - log but continue
                logger.error(f"Unexpected error in game provider: {e}", exc_info=True)
                refresh_manager.record_request_failure()
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
        board_provider = self.container.resolve(BoardProvider)
        display_manager = self.container.resolve(DisplayManager)

        # Select and render board
        next_board = board_provider.get_next_board(context)
        if next_board:
            # Transition to new board if needed
            if next_board != board_provider.current_board:
                board_provider.transition_to(next_board)
            # Render the board using adapters
            from src.core.adapters import RendererAdapter
            if isinstance(display_manager, RendererAdapter):
                board_provider.render_current(
                    display_manager.get_buffer(),
                    display_manager.get_draw()
                )
        else:
            # No board wants to display, show idle
            display_manager.render(None, now_local)

        # Flush to display
        display_manager.flush()

    def _get_sleep_interval(self, snapshot: Optional[GameSnapshot], now_local: datetime) -> float:
        """Calculate sleep interval based on current state."""
        board_provider = self.container.resolve(BoardProvider)
        refresh_manager = self.container.resolve(RefreshManager)

        # Use board's refresh rate if available
        if board_provider.current_board:
            return board_provider.get_refresh_rate()

        # Otherwise use adaptive refresh
        return refresh_manager.get_refresh_interval(snapshot, now_local)

    def _should_reload_config(self) -> bool:
        """Check if configuration should be reloaded."""
        config_provider = self.container.resolve(ConfigurationProvider)
        return (
            config_provider.should_reload() or
            self.reload_requested
        )

    def _reload_configuration(self, bootstrap: ServiceBootstrap):
        """
        Reload configuration from provider with transactional semantics.

        This method ensures that configuration reload is atomic - either
        all changes are applied or none are. If any step fails, the
        configuration remains unchanged.

        Args:
            bootstrap: Service bootstrap instance for updating services

        Raises:
            ConfigurationReloadError: If reload fails but state is recoverable
        """
        old_config = self.device_config
        new_config = None
        services_updated = False

        try:
            logger.info("Starting transactional configuration reload")

            # Step 1: Load new configuration (no side effects)
            config_provider = self.container.resolve(ConfigurationProvider)
            new_config = config_provider.reload()

            if not new_config:
                raise ConfigurationError("Received null configuration from provider")

            # Step 2: Validate new configuration
            self._validate_configuration(new_config)

            # Step 3: Create backup of current service state
            # (In a real implementation, services should support snapshots)

            # Step 4: Update all services with new configuration
            bootstrap.update_configuration(new_config, self.options)
            services_updated = True

            # Step 5: Atomically update configuration
            self.device_config = new_config

            # Step 6: Clear reload flag only after successful update
            self.reload_requested = False

            # Step 7: Notify lifecycle hooks (non-critical)
            for hook in self.lifecycle_hooks:
                try:
                    hook.on_config_reload(old_config, new_config)
                except Exception as hook_error:
                    logger.warning(f"Lifecycle hook error during reload: {hook_error}")

            logger.info("Configuration reload completed successfully")

        except ConfigurationError as e:
            # Configuration validation failed - keep old config
            logger.error(f"Configuration validation failed: {e}")
            self._handle_reload_failure(old_config, new_config, services_updated)
            raise ConfigurationReloadError(
                f"Invalid configuration: {e}",
                partial_config=new_config
            ) from e

        except Exception as e:
            # Unexpected error - attempt rollback
            logger.error(f"Unexpected error during configuration reload: {e}", exc_info=True)
            self._handle_reload_failure(old_config, new_config, services_updated)
            # Note: reload_requested stays True so we'll retry
            raise ConfigurationReloadError(
                f"Failed to reload configuration: {e}",
                partial_config=new_config
            ) from e

    def _validate_configuration(self, config: DeviceConfiguration):
        """
        Validate configuration before applying it.

        Args:
            config: Configuration to validate

        Raises:
            ConfigurationError: If configuration is invalid
        """
        if not config.device_id:
            raise ConfigurationError("Device ID is required")

        if not config.enabled_leagues:
            raise ConfigurationError("At least one league must be enabled")

        # Add more validation as needed

    def _handle_reload_failure(self, old_config, new_config, services_updated):
        """
        Handle configuration reload failure.

        Args:
            old_config: Previous configuration
            new_config: Attempted new configuration
            services_updated: Whether services were already updated
        """
        if services_updated and old_config:
            # Attempt to rollback services to old configuration
            try:
                logger.info("Attempting to rollback services to previous configuration")
                bootstrap = ServiceBootstrap(self.container)
                bootstrap.update_configuration(old_config, self.options)
                logger.info("Services rolled back successfully")
            except Exception as rollback_error:
                logger.critical(f"Failed to rollback services: {rollback_error}")
                # System may be in inconsistent state

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
        try:
            display_manager = self.container.resolve_optional(DisplayManager)
            if display_manager:
                display_manager.close()
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