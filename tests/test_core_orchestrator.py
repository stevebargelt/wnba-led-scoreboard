"""Unit tests for ApplicationOrchestrator."""

import unittest
from unittest.mock import Mock, MagicMock, patch, call
from datetime import datetime
from zoneinfo import ZoneInfo

from src.core.orchestrator import ApplicationOrchestrator
from src.core.options import RuntimeOptions
from src.core.interfaces import (
    ConfigurationProvider,
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
        # Create mock configuration provider
        self.mock_config_provider = Mock(spec=ConfigurationProvider)

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
        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)

        self.assertEqual(orchestrator.config_provider, self.mock_config_provider)
        self.assertEqual(orchestrator.options, self.options)
        self.assertIsNone(orchestrator.device_config)
        self.assertFalse(orchestrator.reload_requested)

    @patch('src.core.orchestrator.signal')
    def test_signal_handlers_setup(self, mock_signal_module):
        """Test that signal handlers are set up."""
        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)

        # Should set up SIGHUP handler
        mock_signal_module.signal.assert_any_call(mock_signal_module.SIGHUP, orchestrator._signal_reload)

    @patch('src.core.orchestrator.Renderer')
    @patch('src.core.orchestrator.BoardManager')
    @patch('src.core.orchestrator.AdaptiveRefreshManager')
    def test_setup_non_demo_mode(self, mock_refresh, mock_board, mock_renderer):
        """Test setup in non-demo mode."""
        self.options.demo_mode = False
        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)

        with patch.object(orchestrator, '_setup_league_aggregator') as mock_setup_agg:
            orchestrator.setup()

            # Should load configuration
            self.mock_config_provider.load_configuration.assert_called_once()
            self.assertEqual(orchestrator.device_config, self.mock_device_config)

            # Should initialize components
            mock_renderer.assert_called_once_with(self.mock_device_config, force_sim=True)
            mock_board.assert_called_once_with(self.mock_device_config)
            mock_refresh.assert_called_once()

            # Should setup league aggregator for non-demo
            mock_setup_agg.assert_called_once()

    @patch('src.core.orchestrator.Renderer')
    @patch('src.core.orchestrator.BoardManager')
    @patch('src.core.orchestrator.AdaptiveRefreshManager')
    def test_setup_demo_mode(self, mock_refresh, mock_board, mock_renderer):
        """Test setup in demo mode."""
        self.options.demo_mode = True
        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)

        with patch.object(orchestrator, '_setup_demo_provider') as mock_setup_demo:
            orchestrator.setup()

            # Should setup demo provider
            mock_setup_demo.assert_called_once()

    @patch('src.core.orchestrator.DemoSimulator')
    def test_setup_demo_provider(self, mock_demo_simulator):
        """Test demo provider setup."""
        self.options.demo_mode = True
        self.options.demo_leagues = ["nhl"]
        self.options.demo_rotation_seconds = 60

        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)
        orchestrator.device_config = self.mock_device_config
        orchestrator._setup_demo_provider()

        # Should create demo simulator
        mock_demo_simulator.assert_called_once()
        self.assertIsNotNone(orchestrator.game_provider)

    @patch('src.core.orchestrator.LeagueAggregator')
    def test_setup_league_aggregator(self, mock_aggregator_class):
        """Test league aggregator setup."""
        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)
        orchestrator.device_config = self.mock_device_config

        mock_aggregator = Mock()
        mock_aggregator_class.return_value = mock_aggregator

        orchestrator._setup_league_aggregator()

        # Should create aggregator with correct leagues
        mock_aggregator_class.assert_called_once_with(
            self.mock_device_config.league_priorities,
            self.mock_device_config.enabled_leagues
        )

        # Should configure priority rules
        mock_aggregator.configure_priority_rules.assert_called_once_with(
            live_game_boost=True,
            favorite_team_boost=True,
            close_game_boost=True,
            playoff_boost=True,
            conflict_resolution='priority'
        )

    def test_signal_reload_handler(self):
        """Test signal reload handler sets flag."""
        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)
        self.assertFalse(orchestrator.reload_requested)

        orchestrator._signal_reload(None, None)
        self.assertTrue(orchestrator.reload_requested)

    def test_build_context(self):
        """Test building context for board selection."""
        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)
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
        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)
        orchestrator.device_config = self.mock_device_config

        now = datetime.now(self.mock_device_config.tz)
        context = orchestrator._build_context(None, now)

        self.assertIsNone(context['game_snapshot'])
        self.assertEqual(context['state'], 'idle')

    def test_should_reload_config(self):
        """Test configuration reload checks."""
        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)

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
        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)

        mock_hook = Mock(spec=ApplicationLifecycle)
        orchestrator.register_lifecycle_hook(mock_hook)

        self.assertIn(mock_hook, orchestrator.lifecycle_hooks)

    @patch('src.core.orchestrator.Renderer')
    @patch('src.core.orchestrator.BoardManager')
    @patch('src.core.orchestrator.AdaptiveRefreshManager')
    def test_cleanup(self, mock_refresh, mock_board, mock_renderer):
        """Test cleanup method."""
        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)

        # Setup mock display manager
        mock_display = Mock()
        orchestrator.display_manager = mock_display

        # Add lifecycle hook
        mock_hook = Mock(spec=ApplicationLifecycle)
        orchestrator.lifecycle_hooks = [mock_hook]

        orchestrator.cleanup()

        # Should call lifecycle hook
        mock_hook.on_shutdown.assert_called_once()

        # Should close display
        mock_display.close.assert_called_once()

    @patch('src.core.orchestrator.Renderer')
    def test_cleanup_with_error(self, mock_renderer):
        """Test cleanup continues even with errors."""
        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)

        # Setup mock that raises error
        mock_display = Mock()
        mock_display.close.side_effect = Exception("Close failed")
        orchestrator.display_manager = mock_display

        # Should not raise exception
        orchestrator.cleanup()

    def test_get_sleep_interval_with_board(self):
        """Test getting sleep interval when board has refresh rate."""
        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)

        # Mock board manager
        mock_board_manager = Mock()
        mock_board_manager.current_board = Mock()
        mock_board_manager.get_current_refresh_rate.return_value = 2.5
        orchestrator.board_manager = mock_board_manager

        interval = orchestrator._get_sleep_interval(None, datetime.now())
        self.assertEqual(interval, 2.5)

    def test_get_sleep_interval_adaptive(self):
        """Test getting sleep interval from adaptive refresh manager."""
        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)

        # No current board
        mock_board_manager = Mock()
        mock_board_manager.current_board = None
        orchestrator.board_manager = mock_board_manager

        # Mock refresh manager
        mock_refresh = Mock()
        mock_refresh.get_refresh_interval.return_value = 5.0
        orchestrator.refresh_manager = mock_refresh

        mock_snapshot = Mock()
        now = datetime.now()

        interval = orchestrator._get_sleep_interval(mock_snapshot, now)

        self.assertEqual(interval, 5.0)
        mock_refresh.get_refresh_interval.assert_called_once_with(mock_snapshot, now)

    @patch('src.core.orchestrator.LeagueAggregator')
    @patch('src.core.orchestrator.Renderer')
    @patch('src.core.orchestrator.BoardManager')
    @patch('src.core.orchestrator.AdaptiveRefreshManager')
    @patch('src.core.orchestrator.time.sleep')
    def test_run_once_mode(self, mock_sleep, mock_refresh_class, mock_board_class,
                          mock_renderer_class, mock_aggregator_class):
        """Test run exits after one cycle in once mode."""
        self.options.run_once = True
        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)

        # Mock components
        mock_board = Mock()
        mock_board.current_board = None
        mock_board.get_next_board.return_value = None
        mock_board.boards = {}  # Add boards dictionary for len() call
        mock_board_class.return_value = mock_board

        mock_refresh = Mock()
        mock_refresh.get_refresh_interval.return_value = 1.0
        mock_refresh_class.return_value = mock_refresh

        mock_display = Mock()
        mock_renderer_class.return_value = mock_display

        mock_aggregator = Mock()
        mock_aggregator.get_featured_game.return_value = None
        mock_aggregator_class.return_value = mock_aggregator

        result = orchestrator.run()

        # Should return 0 for success
        self.assertEqual(result, 0)

        # Sleep should not be called (exits before sleep)
        mock_sleep.assert_not_called()

    @patch('src.core.orchestrator.Renderer')
    @patch('src.core.orchestrator.BoardManager')
    def test_run_handles_keyboard_interrupt(self, mock_board_class, mock_renderer_class):
        """Test run handles KeyboardInterrupt gracefully."""
        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)

        with patch.object(orchestrator, 'setup') as mock_setup:
            with patch.object(orchestrator, '_main_loop') as mock_loop:
                with patch.object(orchestrator, 'cleanup') as mock_cleanup:
                    mock_loop.side_effect = KeyboardInterrupt()

                    result = orchestrator.run()

                    # Should return 0 and cleanup
                    self.assertEqual(result, 0)
                    mock_cleanup.assert_called_once()

    @patch('src.core.orchestrator.Renderer')
    @patch('src.core.orchestrator.BoardManager')
    def test_run_handles_exception(self, mock_board_class, mock_renderer_class):
        """Test run handles exceptions and returns error code."""
        orchestrator = ApplicationOrchestrator(self.mock_config_provider, self.options)

        with patch.object(orchestrator, 'setup') as mock_setup:
            mock_setup.side_effect = Exception("Setup failed")

            with patch.object(orchestrator, 'cleanup') as mock_cleanup:
                result = orchestrator.run()

                # Should return 1 for error
                self.assertEqual(result, 1)
                mock_cleanup.assert_called_once()


if __name__ == '__main__':
    unittest.main()