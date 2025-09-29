"""Unit tests for ApplicationOrchestrator."""

import unittest
from unittest.mock import Mock, MagicMock, patch, call
from datetime import datetime
from zoneinfo import ZoneInfo

from src.core.orchestrator import ApplicationOrchestrator
from src.core.container import ServiceContainer
from src.core.options import RuntimeOptions
from src.core.interfaces import (
    ConfigurationProvider,
    DisplayManager,
    BoardProvider,
    RefreshManager,
    GameProvider,
    ApplicationLifecycle,
    ApplicationContext
)
from src.config.supabase_config_loader import DeviceConfiguration
from src.config.types import MatrixConfig, RefreshConfig, RenderConfig
from src.model.game import GameSnapshot, GameState, TeamInfo as GameTeamInfo


class TestApplicationOrchestrator(unittest.TestCase):
    """Test cases for ApplicationOrchestrator."""

    def setUp(self):
        """Set up test fixtures."""
        # Create mock container
        self.container = ServiceContainer()

        # Create mock services
        self.mock_config_provider = Mock(spec=ConfigurationProvider)
        self.mock_display_manager = Mock(spec=DisplayManager)
        self.mock_board_provider = Mock(spec=BoardProvider)
        self.mock_refresh_manager = Mock(spec=RefreshManager)
        self.mock_game_provider = Mock(spec=GameProvider)

        # Register mocks in container
        self.container.register(ConfigurationProvider, self.mock_config_provider)
        self.container.register(DisplayManager, self.mock_display_manager)
        self.container.register(BoardProvider, self.mock_board_provider)
        self.container.register(RefreshManager, self.mock_refresh_manager)
        self.container.register(GameProvider, self.mock_game_provider)

        # Create mock device configuration
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

        self.mock_config_provider.load_configuration.return_value = self.mock_device_config

        # Create runtime options
        self.options = RuntimeOptions()
        self.options.force_simulation = True
        self.options.run_once = False

    def test_initialization(self):
        """Test orchestrator initialization."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        self.assertEqual(orchestrator.container, self.container)
        self.assertEqual(orchestrator.options, self.options)
        self.assertIsNone(orchestrator.device_config)
        self.assertFalse(orchestrator.reload_requested)

    @patch('src.core.orchestrator.signal')
    def test_signal_handlers_setup(self, mock_signal_module):
        """Test that signal handlers are set up."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        # Should set up SIGHUP handler
        mock_signal_module.signal.assert_any_call(mock_signal_module.SIGHUP, orchestrator._signal_reload)

    def test_setup_non_demo_mode(self):
        """Test setup in non-demo mode."""
        self.options.demo_mode = False
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        orchestrator.setup(self.mock_device_config)

        # Should store configuration
        self.assertEqual(orchestrator.device_config, self.mock_device_config)

        # Should resolve services from container
        self.container.resolve(ConfigurationProvider)
        self.container.resolve(DisplayManager)
        self.container.resolve(BoardProvider)
        self.container.resolve(GameProvider)
        self.container.resolve(RefreshManager)

    def test_setup_demo_mode(self):
        """Test setup in demo mode."""
        self.options.demo_mode = True
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        orchestrator.setup(self.mock_device_config)

        # Should store configuration
        self.assertEqual(orchestrator.device_config, self.mock_device_config)

    def test_signal_reload_handler(self):
        """Test signal reload handler sets flag."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)
        self.assertFalse(orchestrator.reload_requested)

        orchestrator._signal_reload(None, None)
        self.assertTrue(orchestrator.reload_requested)

    def test_build_context(self):
        """Test building context for board selection."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)
        orchestrator.device_config = self.mock_device_config

        # Create a mock game snapshot
        mock_snapshot = Mock(spec=GameSnapshot)
        mock_snapshot.state = GameState.LIVE

        now = datetime.now(self.mock_device_config.tz)
        context = orchestrator._build_context(mock_snapshot, now)

        self.assertEqual(context['game_snapshot'], mock_snapshot)
        self.assertEqual(context['current_time'], now)
        self.assertEqual(context['state'], 'live')
        self.assertEqual(context['device_config'], self.mock_device_config)
        self.assertIn('favorite_teams', context)

    def test_build_context_idle_state(self):
        """Test building context with no game snapshot."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)
        orchestrator.device_config = self.mock_device_config

        now = datetime.now(self.mock_device_config.tz)
        context = orchestrator._build_context(None, now)

        self.assertIsNone(context['game_snapshot'])
        self.assertEqual(context['state'], 'idle')

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

    def test_register_lifecycle_hook(self):
        """Test registering lifecycle hooks."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        mock_hook = Mock(spec=ApplicationLifecycle)
        orchestrator.register_lifecycle_hook(mock_hook)

        self.assertIn(mock_hook, orchestrator.lifecycle_hooks)

    def test_cleanup(self):
        """Test cleanup method."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        # Add lifecycle hook
        mock_hook = Mock(spec=ApplicationLifecycle)
        orchestrator.lifecycle_hooks = [mock_hook]

        orchestrator.cleanup()

        # Should call lifecycle hook
        mock_hook.on_shutdown.assert_called_once()

        # Should close display
        self.mock_display_manager.close.assert_called_once()

    def test_cleanup_with_error(self):
        """Test cleanup continues even with errors."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        # Setup mock that raises error
        self.mock_display_manager.close.side_effect = Exception("Close failed")

        # Should not raise exception
        orchestrator.cleanup()

    def test_get_sleep_interval_with_board(self):
        """Test getting sleep interval when board has refresh rate."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        # Mock board with refresh rate
        self.mock_board_provider.current_board = Mock()
        self.mock_board_provider.get_refresh_rate.return_value = 2.5

        interval = orchestrator._get_sleep_interval(None, datetime.now())
        self.assertEqual(interval, 2.5)

    def test_get_sleep_interval_adaptive(self):
        """Test getting sleep interval from adaptive refresh manager."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        # No current board
        self.mock_board_provider.current_board = None

        # Mock refresh manager
        self.mock_refresh_manager.get_refresh_interval.return_value = 5.0

        mock_snapshot = Mock()
        now = datetime.now()

        interval = orchestrator._get_sleep_interval(mock_snapshot, now)

        self.assertEqual(interval, 5.0)
        self.mock_refresh_manager.get_refresh_interval.assert_called_once_with(mock_snapshot, now)

    @patch('src.core.orchestrator.time.sleep')
    def test_run_once_mode(self, mock_sleep):
        """Test run exits after one cycle in once mode."""
        self.options.run_once = True
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        # Mock game provider and board provider
        self.mock_game_provider.get_current_game.return_value = None
        self.mock_board_provider.get_next_board.return_value = None
        self.mock_board_provider.current_board = None
        self.mock_refresh_manager.get_refresh_interval.return_value = 1.0

        result = orchestrator.run(self.mock_device_config)

        # Should return 0 for success
        self.assertEqual(result, 0)

        # Sleep should not be called (exits before sleep)
        mock_sleep.assert_not_called()

    def test_run_handles_keyboard_interrupt(self):
        """Test run handles KeyboardInterrupt gracefully."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        with patch.object(orchestrator, 'setup') as mock_setup:
            with patch.object(orchestrator, '_main_loop') as mock_loop:
                with patch.object(orchestrator, 'cleanup') as mock_cleanup:
                    mock_loop.side_effect = KeyboardInterrupt()

                    result = orchestrator.run(self.mock_device_config)

                    # Should return 0 and cleanup
                    self.assertEqual(result, 0)
                    mock_cleanup.assert_called_once()

    def test_run_handles_exception(self):
        """Test run handles exceptions and returns error code."""
        orchestrator = ApplicationOrchestrator(self.container, self.options)

        with patch.object(orchestrator, 'setup') as mock_setup:
            mock_setup.side_effect = Exception("Setup failed")

            with patch.object(orchestrator, 'cleanup') as mock_cleanup:
                result = orchestrator.run(self.mock_device_config)

                # Should return 1 for error
                self.assertEqual(result, 1)
                mock_cleanup.assert_called_once()


if __name__ == '__main__':
    unittest.main()