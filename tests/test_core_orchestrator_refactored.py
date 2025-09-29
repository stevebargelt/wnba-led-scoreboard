"""Unit tests for refactored ApplicationOrchestrator."""

import unittest
from unittest.mock import Mock, MagicMock, patch, call
from datetime import datetime
from zoneinfo import ZoneInfo

from src.core.orchestrator import ApplicationOrchestrator
from src.core.container import ServiceContainer
from src.core.options import RuntimeOptions
from src.core.bootstrap import ServiceBootstrap
from src.core.interfaces import (
    ConfigurationProvider,
    DisplayManager,
    BoardProvider,
    RefreshManager,
    GameProvider,
    ApplicationLifecycle
)
from src.config.supabase_config_loader import DeviceConfiguration
from src.config.types import MatrixConfig, RefreshConfig, RenderConfig
from src.model.game import GameSnapshot, GameState, TeamInfo as GameTeamInfo


class TestApplicationOrchestratorRefactored(unittest.TestCase):
    """Test cases for refactored ApplicationOrchestrator using DI container."""

    def setUp(self):
        """Set up test fixtures."""
        # Create mock container with all services
        self.container = ServiceContainer()
        self._setup_mock_services()

        # Create runtime options
        self.options = RuntimeOptions()
        self.options.force_simulation = True
        self.options.run_once = False

        # Create mock device configuration
        self._setup_mock_config()

    def _setup_mock_services(self):
        """Set up mock services in container."""
        self.mock_config_provider = Mock(spec=ConfigurationProvider)
        self.mock_display_manager = Mock(spec=DisplayManager)
        self.mock_board_provider = Mock(spec=BoardProvider)
        self.mock_refresh_manager = Mock(spec=RefreshManager)
        self.mock_game_provider = Mock(spec=GameProvider)

        # Configure mock board provider
        self.mock_board_provider.current_board = None
        self.mock_board_provider.get_refresh_rate.return_value = 2.0
        self.mock_board_provider.transition_to = Mock()  # Add missing mock method

        # Register all services
        self.container.register(ConfigurationProvider, self.mock_config_provider)
        self.container.register(DisplayManager, self.mock_display_manager)
        self.container.register(BoardProvider, self.mock_board_provider)
        self.container.register(RefreshManager, self.mock_refresh_manager)
        self.container.register(GameProvider, self.mock_game_provider)

    def _setup_mock_config(self):
        """Set up mock device configuration."""
        self.mock_device_config = Mock(spec=DeviceConfiguration)
        self.mock_device_config.device_id = "test_device"
        self.mock_device_config.timezone = "America/New_York"
        self.mock_device_config.tz = ZoneInfo("America/New_York")
        self.mock_device_config.enabled_leagues = ["nhl", "nba"]
        self.mock_device_config.league_priorities = ["nhl", "nba"]
        self.mock_device_config.favorite_teams = {}
        self.mock_device_config.matrix_config = Mock(spec=MatrixConfig)
        self.mock_device_config.matrix_config.width = 64
        self.mock_device_config.matrix_config.height = 32
        self.mock_device_config.refresh_config = Mock(spec=RefreshConfig)
        self.mock_device_config.render_config = Mock(spec=RenderConfig)

    def test_initialization(self):
        """Test orchestrator initialization with container."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        self.assertEqual(orchestrator.container, self.container)
        self.assertEqual(orchestrator.options, self.options)
        self.assertIsNone(orchestrator.device_config)
        self.assertFalse(orchestrator.reload_requested)
        self.assertEqual(orchestrator.lifecycle_hooks, [])

    def test_setup_resolves_services(self):
        """Test that setup resolves all services from container."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)
        orchestrator.setup(self.mock_device_config)

        # Verify device config is stored
        self.assertEqual(orchestrator.device_config, self.mock_device_config)

        # Services should be available in container (not stored on orchestrator)
        self.assertIsNotNone(self.container.resolve(ConfigurationProvider))
        self.assertIsNotNone(self.container.resolve(DisplayManager))
        self.assertIsNotNone(self.container.resolve(BoardProvider))
        self.assertIsNotNone(self.container.resolve(GameProvider))
        self.assertIsNotNone(self.container.resolve(RefreshManager))

    def test_signal_reload_handler(self):
        """Test signal reload handler sets flag."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)
        self.assertFalse(orchestrator.reload_requested)

        orchestrator._signal_reload(None, None)
        self.assertTrue(orchestrator.reload_requested)

    def test_get_game_snapshot_success(self):
        """Test getting game snapshot from provider."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)
        orchestrator.device_config = self.mock_device_config

        # Mock game snapshot
        mock_snapshot = Mock(spec=GameSnapshot)
        mock_snapshot.away = Mock(abbr="NYR")
        mock_snapshot.home = Mock(abbr="BOS")
        self.mock_game_provider.get_current_game.return_value = mock_snapshot

        now = datetime.now(self.mock_device_config.tz)
        snapshot = orchestrator._get_game_snapshot(now)

        self.assertEqual(snapshot, mock_snapshot)
        self.mock_game_provider.get_current_game.assert_called_once_with(now)
        self.mock_refresh_manager.record_request_success.assert_called_once()

    def test_get_game_snapshot_failure(self):
        """Test handling game provider failure."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)
        orchestrator.device_config = self.mock_device_config

        self.mock_game_provider.get_current_game.side_effect = Exception("API Error")

        now = datetime.now(self.mock_device_config.tz)
        snapshot = orchestrator._get_game_snapshot(now)

        self.assertIsNone(snapshot)
        self.mock_refresh_manager.record_request_failure.assert_called_once()

    def test_build_context(self):
        """Test building context for board selection."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)
        orchestrator.device_config = self.mock_device_config

        mock_snapshot = Mock(spec=GameSnapshot)
        mock_snapshot.state = GameState.LIVE

        now = datetime.now(self.mock_device_config.tz)
        context = orchestrator._build_context(mock_snapshot, now)

        self.assertEqual(context['game_snapshot'], mock_snapshot)
        self.assertEqual(context['current_time'], now)
        self.assertEqual(context['state'], 'live')
        self.assertEqual(context['device_config'], self.mock_device_config)

    def test_render_with_board(self):
        """Test rendering when a board is selected."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        mock_board = Mock()
        self.mock_board_provider.get_next_board.return_value = mock_board
        self.mock_board_provider.current_board = None

        context = {'test': 'context'}
        now = datetime.now()

        orchestrator._render(context, None, now)

        self.mock_board_provider.get_next_board.assert_called_once_with(context)
        self.mock_board_provider.transition_to.assert_called_once_with(mock_board)
        self.mock_display_manager.flush.assert_called_once()

    def test_render_idle_when_no_board(self):
        """Test rendering idle when no board selected."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        self.mock_board_provider.get_next_board.return_value = None

        context = {'test': 'context'}
        now = datetime.now()

        orchestrator._render(context, None, now)

        self.mock_display_manager.render.assert_called_once_with(None, now)
        self.mock_display_manager.flush.assert_called_once()

    def test_get_sleep_interval_from_board(self):
        """Test getting sleep interval from board refresh rate."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        self.mock_board_provider.current_board = Mock()
        self.mock_board_provider.get_refresh_rate.return_value = 3.5

        interval = orchestrator._get_sleep_interval(None, datetime.now())
        self.assertEqual(interval, 3.5)

    def test_get_sleep_interval_from_refresh_manager(self):
        """Test getting sleep interval from refresh manager."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        self.mock_board_provider.current_board = None
        self.mock_refresh_manager.get_refresh_interval.return_value = 5.0

        now = datetime.now()
        mock_snapshot = Mock()

        interval = orchestrator._get_sleep_interval(mock_snapshot, now)
        self.assertEqual(interval, 5.0)
        self.mock_refresh_manager.get_refresh_interval.assert_called_once_with(mock_snapshot, now)

    def test_should_reload_config(self):
        """Test configuration reload checks."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        # Test with reload_requested flag
        orchestrator.reload_requested = True
        self.assertTrue(orchestrator._should_reload_config())

        # Test with provider should_reload
        orchestrator.reload_requested = False
        self.mock_config_provider.should_reload.return_value = True
        self.assertTrue(orchestrator._should_reload_config())

        # Test when neither condition is met
        orchestrator.reload_requested = False
        self.mock_config_provider.should_reload.return_value = False
        self.assertFalse(orchestrator._should_reload_config())

    def test_cleanup(self):
        """Test cleanup method."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        # Add a lifecycle hook
        mock_hook = Mock(spec=ApplicationLifecycle)
        orchestrator.lifecycle_hooks = [mock_hook]

        orchestrator.cleanup()

        mock_hook.on_shutdown.assert_called_once()
        self.mock_display_manager.close.assert_called_once()

    def test_cleanup_handles_errors(self):
        """Test cleanup continues even with errors."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        self.mock_display_manager.close.side_effect = Exception("Close failed")

        # Should not raise exception
        orchestrator.cleanup()

    def test_register_lifecycle_hook(self):
        """Test registering lifecycle hooks."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        mock_hook = Mock(spec=ApplicationLifecycle)
        orchestrator.register_lifecycle_hook(mock_hook)

        self.assertIn(mock_hook, orchestrator.lifecycle_hooks)

    @patch('src.core.orchestrator.time.sleep')
    def test_run_once_mode(self, mock_sleep):
        """Test run exits after one cycle in once mode."""
        self.options.run_once = True
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        # Setup mock game provider
        self.mock_game_provider.get_current_game.return_value = None
        self.mock_board_provider.get_next_board.return_value = None
        self.mock_board_provider.current_board = None
        self.mock_refresh_manager.get_refresh_interval.return_value = 1.0

        result = orchestrator.run(self.mock_device_config)

        # Should return 0 for success
        self.assertEqual(result, 0)

        # Sleep should not be called (exits before sleep)
        mock_sleep.assert_not_called()

    def test_reload_configuration(self):
        """Test configuration reload."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)
        orchestrator.device_config = self.mock_device_config

        # Create mock bootstrap
        mock_bootstrap = Mock(spec=ServiceBootstrap)

        # Mock new config with required attributes for validation
        new_config = Mock(spec=DeviceConfiguration)
        new_config.device_id = "test_device"
        new_config.enabled_leagues = ["nhl", "nba"]
        self.mock_config_provider.reload.return_value = new_config

        orchestrator._reload_configuration(mock_bootstrap)

        # Should update configuration
        self.assertEqual(orchestrator.device_config, new_config)
        mock_bootstrap.update_configuration.assert_called_once_with(new_config, self.options)
        self.assertFalse(orchestrator.reload_requested)


if __name__ == '__main__':
    unittest.main()