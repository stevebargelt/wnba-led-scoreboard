"""
Game provider implementations for flexible data source management.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any

from src.core.interfaces import GameProvider
from src.config.supabase_config_loader import DeviceConfiguration
from src.model.game import GameSnapshot, GameState, TeamInfo
from src.core.logging import get_logger

logger = get_logger(__name__)


class LeagueAggregatorProvider(GameProvider):
    """
    Production provider that aggregates games from multiple leagues.
    """

    def __init__(self, league_aggregator):
        """
        Initialize with league aggregator.

        Args:
            league_aggregator: The league aggregator instance
        """
        self.aggregator = league_aggregator
        self._last_refresh = None
        self._config = None

    def get_current_game(self, current_time: datetime) -> Optional[GameSnapshot]:
        """Get current game from league aggregator."""
        try:
            return self.aggregator.get_current_game(current_time)
        except Exception as e:
            logger.error(f"Failed to get game from aggregator: {e}")
            return None

    def configure(self, config: DeviceConfiguration) -> None:
        """Configure the provider with device settings."""
        self._config = config
        # Pass configuration to aggregator if needed
        if hasattr(self.aggregator, 'configure'):
            self.aggregator.configure(config)

    def refresh(self) -> bool:
        """Refresh aggregator data - helper method not in interface."""
        try:
            self.aggregator.update()
            self._last_refresh = datetime.now()
            return True
        except Exception as e:
            logger.error(f"Failed to refresh aggregator: {e}")
            return False

    def is_available(self) -> bool:
        """Check if aggregator is available - helper method not in interface."""
        return self.aggregator is not None


class DemoProvider(GameProvider):
    """
    Demo provider that generates fake games for testing.
    """

    def __init__(self, demo_games: Optional[List[GameSnapshot]] = None):
        """
        Initialize with optional list of demo games.

        Args:
            demo_games: List of pre-configured demo games
        """
        self.demo_games = demo_games or []
        self._current_index = 0
        self._config = None

    def get_current_game(self, current_time: datetime) -> Optional[GameSnapshot]:
        """Get next demo game in rotation."""
        if not self.demo_games:
            return self._generate_demo_game(current_time)

        if self._current_index >= len(self.demo_games):
            self._current_index = 0

        game = self.demo_games[self._current_index]
        self._current_index += 1
        return game

    def configure(self, config: DeviceConfiguration) -> None:
        """Configure the provider with device settings."""
        self._config = config

    def refresh(self) -> bool:
        """Demo provider always succeeds refresh - helper method."""
        return True

    def is_available(self) -> bool:
        """Demo provider is always available - helper method."""
        return True

    def _generate_demo_game(self, now: datetime) -> GameSnapshot:
        """Generate a random demo game."""
        from random import choice, randint
        from src.sports.models.sport_config import (
            SportConfig, TimingConfig, ScoringConfig, TerminologyConfig,
            PeriodType, ClockDirection
        )
        from src.sports.models.league_config import LeagueConfig

        # Create minimal but valid sport/league configs for demo
        timing = TimingConfig(
            period_type=PeriodType.QUARTER,
            regulation_periods=4,
            period_duration_minutes=12,
            clock_direction=ClockDirection.COUNT_DOWN,
            has_overtime=True,
            overtime_duration_minutes=5
        )

        scoring = ScoringConfig(
            scoring_types={"field_goal": 2, "three_pointer": 3, "free_throw": 1},
            default_score_value=2
        )

        terminology = TerminologyConfig(
            game_start_term="Tip-off",
            period_end_term="End of Quarter",
            game_end_term="Final",
            overtime_term="Overtime"
        )

        sport = SportConfig(
            name="Basketball",
            code="basketball",
            timing=timing,
            scoring=scoring,
            terminology=terminology
        )

        league = LeagueConfig(
            name="Demo League",
            code="demo",
            sport_code="basketball",
            api=None,
            team_count=30
        )

        states = [GameState.PRE, GameState.LIVE, GameState.FINAL]
        state = choice(states)

        home_score = randint(0, 120) if state != GameState.PRE else 0
        away_score = randint(0, 120) if state != GameState.PRE else 0

        return GameSnapshot(
            sport=sport,
            league=league,
            event_id=f"demo_{now.timestamp()}",
            start_time_local=now,
            state=state,
            home=TeamInfo(
                id="home",
                name="Home Team",
                abbr="HOM",
                score=home_score
            ),
            away=TeamInfo(
                id="away",
                name="Away Team",
                abbr="AWY",
                score=away_score
            ),
            current_period=choice([1, 2, 3, 4]) if state == GameState.LIVE else 0,
            period_name="Q2" if state == GameState.LIVE else "",
            display_clock="8:45" if state == GameState.LIVE else "",
            seconds_to_start=-1,
            status_detail="Demo Game"
        )


class SingleLeagueProvider(GameProvider):
    """
    Provider that focuses on a single league.
    """

    def __init__(self, league_client, league_code: str):
        """
        Initialize with a specific league client.

        Args:
            league_client: The league client instance
            league_code: The league code to focus on
        """
        self.client = league_client
        self.league_code = league_code
        self._games_cache = []
        self._last_refresh = None
        self._config = None

    def get_current_game(self, current_time: datetime) -> Optional[GameSnapshot]:
        """Get current game from single league."""
        if not self._games_cache:
            self.refresh()

        # Find best game (live > upcoming > recent final)
        live_games = [g for g in self._games_cache if g.state == GameState.LIVE]
        if live_games:
            return live_games[0]

        upcoming = [g for g in self._games_cache if g.state == GameState.PRE]
        if upcoming:
            return min(upcoming, key=lambda g: abs((g.start_time_local - current_time).total_seconds()))

        final_games = [g for g in self._games_cache if g.state == GameState.FINAL]
        if final_games:
            return max(final_games, key=lambda g: g.start_time_local)

        return None

    def configure(self, config: DeviceConfiguration) -> None:
        """Configure the provider with device settings."""
        self._config = config

    def refresh(self) -> bool:
        """Refresh games from league client - helper method."""
        try:
            from datetime import date
            self._games_cache = self.client.fetch_games(date.today())
            self._last_refresh = datetime.now()
            return True
        except Exception as e:
            logger.error(f"Failed to refresh {self.league_code} games: {e}")
            return False

    def is_available(self) -> bool:
        """Check if league client is available - helper method."""
        return self.client is not None and self.client.is_league_active()


class MockProvider(GameProvider):
    """
    Mock provider for testing.
    """

    def __init__(self):
        """Initialize mock provider."""
        self.games = []
        self.current_game = None
        self.available = True
        self.refresh_count = 0
        self._config = None

    def get_current_game(self, current_time: datetime) -> Optional[GameSnapshot]:
        """Return configured current game."""
        return self.current_game

    def configure(self, config: DeviceConfiguration) -> None:
        """Configure the provider with device settings."""
        self._config = config

    def refresh(self) -> bool:
        """Track refresh calls - helper method."""
        self.refresh_count += 1
        return self.available

    def is_available(self) -> bool:
        """Return configured availability - helper method."""
        return self.available

    def set_current_game(self, game: GameSnapshot):
        """Set the current game for testing."""
        self.current_game = game

    def set_available(self, available: bool):
        """Set availability for testing."""
        self.available = available