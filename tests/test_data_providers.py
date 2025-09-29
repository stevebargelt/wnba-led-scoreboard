"""Unit tests for data layer game providers."""

import unittest
from datetime import datetime, date, timedelta
from unittest.mock import Mock, MagicMock, patch

from src.core.interfaces import GameProvider
from src.data.providers import (
    LeagueAggregatorProvider,
    DemoProvider,
    SingleLeagueProvider,
    MockProvider
)
from src.model.game import GameSnapshot, GameState, TeamInfo
from src.sports.models.sport_config import SportConfig
from src.sports.models.league_config import LeagueConfig
from src.config.supabase_config_loader import DeviceConfiguration


class TestGameProviderInterface(unittest.TestCase):
    """Test the abstract GameProvider interface."""

    def test_interface_methods_required(self):
        """Test that GameProvider requires implementation of interface methods."""
        with self.assertRaises(TypeError):
            # Can't instantiate abstract class
            GameProvider()


class TestLeagueAggregatorProvider(unittest.TestCase):
    """Test the LeagueAggregatorProvider implementation."""

    def setUp(self):
        """Set up test fixtures."""
        self.mock_aggregator = Mock()
        self.provider = LeagueAggregatorProvider(self.mock_aggregator)

    def test_get_current_game_success(self):
        """Test successful game retrieval."""
        mock_game = self._create_mock_game()
        self.mock_aggregator.get_current_game.return_value = mock_game
        current_time = datetime.now()

        game = self.provider.get_current_game(current_time)

        self.assertEqual(game, mock_game)
        self.mock_aggregator.get_current_game.assert_called_once_with(current_time)

    def test_configure(self):
        """Test configuration method."""
        mock_config = Mock(spec=DeviceConfiguration)
        self.provider.configure(mock_config)
        self.assertEqual(self.provider._config, mock_config)

    def test_get_current_game_error_handling(self):
        """Test error handling in game retrieval."""
        self.mock_aggregator.get_current_game.side_effect = Exception("API Error")
        current_time = datetime.now()

        game = self.provider.get_current_game(current_time)

        self.assertIsNone(game)

    def test_refresh_success(self):
        """Test successful refresh."""
        self.mock_aggregator.update.return_value = None

        result = self.provider.refresh()

        self.assertTrue(result)
        self.mock_aggregator.update.assert_called_once()
        self.assertIsNotNone(self.provider._last_refresh)

    def test_refresh_failure(self):
        """Test refresh failure handling."""
        self.mock_aggregator.update.side_effect = Exception("Network Error")

        result = self.provider.refresh()

        self.assertFalse(result)

    def test_is_available(self):
        """Test availability check."""
        self.assertTrue(self.provider.is_available())

        provider_none = LeagueAggregatorProvider(None)
        self.assertFalse(provider_none.is_available())

    def _create_mock_game(self) -> GameSnapshot:
        """Create a mock game snapshot."""
        sport = Mock(spec=SportConfig)
        league = Mock(spec=LeagueConfig)

        return GameSnapshot(
            sport=sport,
            league=league,
            event_id="test123",
            start_time_local=datetime.now(),
            state=GameState.LIVE,
            home=TeamInfo(id="1", name="Home", abbr="HOM", score=100),
            away=TeamInfo(id="2", name="Away", abbr="AWY", score=98),
            current_period=4,
            period_name="Q4",
            display_clock="2:30",
            seconds_to_start=-1
        )


class TestDemoProvider(unittest.TestCase):
    """Test the DemoProvider implementation."""

    def test_with_predefined_games(self):
        """Test demo provider with predefined games."""
        games = [
            Mock(spec=GameSnapshot),
            Mock(spec=GameSnapshot),
            Mock(spec=GameSnapshot)
        ]
        provider = DemoProvider(games)
        current_time = datetime.now()

        # Should cycle through games
        self.assertEqual(provider.get_current_game(current_time), games[0])
        self.assertEqual(provider.get_current_game(current_time), games[1])
        self.assertEqual(provider.get_current_game(current_time), games[2])
        self.assertEqual(provider.get_current_game(current_time), games[0])  # Back to start

    def test_with_generated_games(self):
        """Test demo provider with generated games."""
        provider = DemoProvider()
        current_time = datetime.now()

        game = provider.get_current_game(current_time)

        self.assertIsNotNone(game)
        self.assertIsInstance(game, GameSnapshot)
        self.assertIn(game.state, [GameState.PRE, GameState.LIVE, GameState.FINAL])

    def test_refresh_always_succeeds(self):
        """Test that demo refresh always succeeds."""
        provider = DemoProvider()
        self.assertTrue(provider.refresh())

    def test_always_available(self):
        """Test that demo provider is always available."""
        provider = DemoProvider()
        self.assertTrue(provider.is_available())


class TestSingleLeagueProvider(unittest.TestCase):
    """Test the SingleLeagueProvider implementation."""

    def setUp(self):
        """Set up test fixtures."""
        self.mock_client = Mock()
        self.mock_client.is_league_active.return_value = True
        self.provider = SingleLeagueProvider(self.mock_client, "nba")

    def test_get_current_game_live_priority(self):
        """Test that live games have priority."""
        games = [
            self._create_game(GameState.PRE),
            self._create_game(GameState.LIVE),
            self._create_game(GameState.FINAL)
        ]
        self.mock_client.fetch_games.return_value = games
        current_time = datetime.now()

        game = self.provider.get_current_game(current_time)

        self.assertEqual(game.state, GameState.LIVE)

    def test_get_current_game_upcoming_selection(self):
        """Test selection of closest upcoming game."""
        current_time = datetime.now()
        games = [
            self._create_game(GameState.PRE, current_time + timedelta(hours=3)),
            self._create_game(GameState.PRE, current_time + timedelta(hours=1)),
            self._create_game(GameState.PRE, current_time + timedelta(hours=5))
        ]
        self.mock_client.fetch_games.return_value = games

        game = self.provider.get_current_game(current_time)

        # Should select the game 1 hour from now
        self.assertEqual(game, games[1])

    def test_get_current_game_recent_final(self):
        """Test selection of most recent final game."""
        current_time = datetime.now()
        games = [
            self._create_game(GameState.FINAL, current_time - timedelta(hours=3)),
            self._create_game(GameState.FINAL, current_time - timedelta(hours=1)),
            self._create_game(GameState.FINAL, current_time - timedelta(hours=5))
        ]
        self.mock_client.fetch_games.return_value = games

        game = self.provider.get_current_game(current_time)

        # Should select the game 1 hour ago (most recent)
        self.assertEqual(game, games[1])

    def test_refresh_success(self):
        """Test successful refresh."""
        games = [self._create_game(GameState.LIVE)]
        self.mock_client.fetch_games.return_value = games

        result = self.provider.refresh()

        self.assertTrue(result)
        self.assertEqual(self.provider._games_cache, games)
        self.assertIsNotNone(self.provider._last_refresh)

    def test_refresh_failure(self):
        """Test refresh failure handling."""
        self.mock_client.fetch_games.side_effect = Exception("API Error")

        result = self.provider.refresh()

        self.assertFalse(result)

    def test_is_available(self):
        """Test availability check."""
        self.assertTrue(self.provider.is_available())

        self.mock_client.is_league_active.return_value = False
        self.assertFalse(self.provider.is_available())

        provider_none = SingleLeagueProvider(None, "nba")
        self.assertFalse(provider_none.is_available())

    def test_refresh_on_empty_cache(self):
        """Test that refresh is called when cache is empty."""
        game = self._create_game(GameState.LIVE)
        self.mock_client.fetch_games.return_value = [game]
        current_time = datetime.now()

        result = self.provider.get_current_game(current_time)

        self.mock_client.fetch_games.assert_called_once()
        self.assertEqual(result, game)

    def _create_game(self, state: GameState, start_time: datetime = None) -> GameSnapshot:
        """Create a test game snapshot."""
        sport = Mock(spec=SportConfig)
        league = Mock(spec=LeagueConfig)

        return GameSnapshot(
            sport=sport,
            league=league,
            event_id=f"test_{state.name}",
            start_time_local=start_time or datetime.now(),
            state=state,
            home=TeamInfo(id="1", name="Home", abbr="HOM", score=100),
            away=TeamInfo(id="2", name="Away", abbr="AWY", score=98),
            current_period=4 if state == GameState.LIVE else 0,
            period_name="Q4" if state == GameState.LIVE else "",
            display_clock="2:30" if state == GameState.LIVE else "",
            seconds_to_start=-1
        )


class TestMockProvider(unittest.TestCase):
    """Test the MockProvider implementation."""

    def test_mock_provider_operations(self):
        """Test mock provider basic operations."""
        provider = MockProvider()
        mock_game = Mock(spec=GameSnapshot)
        current_time = datetime.now()

        # Test initial state
        self.assertIsNone(provider.get_current_game(current_time))
        self.assertTrue(provider.is_available())
        self.assertEqual(provider.refresh_count, 0)

        # Test setting game
        provider.set_current_game(mock_game)
        self.assertEqual(provider.get_current_game(current_time), mock_game)

        # Test configuration
        mock_config = Mock(spec=DeviceConfiguration)
        provider.configure(mock_config)
        self.assertEqual(provider._config, mock_config)

        # Test refresh
        self.assertTrue(provider.refresh())
        self.assertEqual(provider.refresh_count, 1)

        # Test availability control
        provider.set_available(False)
        self.assertFalse(provider.is_available())
        self.assertFalse(provider.refresh())
        self.assertEqual(provider.refresh_count, 2)


if __name__ == '__main__':
    unittest.main()