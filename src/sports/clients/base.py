"""Base classes for league-specific API clients."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from datetime import date, datetime
from typing import List, Optional, Dict, Any
import logging

from ..models.league_config import LeagueConfig
from ..models.sport_config import SportConfig, TimingConfig, ScoringConfig, TerminologyConfig
from src.model.game import GameState, TeamSide

logger = logging.getLogger(__name__)


@dataclass
class LeagueGameSnapshot:
    """Enhanced game snapshot with sport/league information."""
    # League and sport information
    sport: SportConfig
    league: LeagueConfig

    # Game identification
    event_id: str
    start_time_local: datetime

    # Game state
    state: GameState

    # Teams
    home: TeamSide
    away: TeamSide

    # Timing
    current_period: int
    period_name: str
    display_clock: str
    seconds_to_start: int = -1

    # Status
    status_detail: str = ""

    # Sport-specific data
    sport_specific_data: Dict[str, Any] = None

    def __post_init__(self):
        if self.sport_specific_data is None:
            self.sport_specific_data = {}


class LeagueClient(ABC):
    """Base class for league-specific API clients."""

    def __init__(self, league: LeagueConfig, sport: SportConfig):
        self.league = league
        self.sport = sport
        self.effective_timing = league.get_effective_timing(sport.timing)
        self.effective_scoring = league.get_effective_scoring(sport.scoring)
        self.effective_terminology = league.get_effective_terminology(sport.terminology)

    @abstractmethod
    def fetch_games(self, target_date: date) -> List[LeagueGameSnapshot]:
        """
        Fetch games for the target date.

        Args:
            target_date: Date to fetch games for

        Returns:
            List of LeagueGameSnapshot objects
        """
        pass

    @abstractmethod
    def fetch_teams(self) -> List[Dict[str, Any]]:
        """
        Fetch team information for the league.

        Returns:
            List of team dictionaries with at minimum:
            - id: Team identifier
            - name: Full team name
            - abbreviation: Team abbreviation
            - logo_url: Optional URL to team logo
            - colors: Optional dictionary of team colors
        """
        pass

    def format_period_name(self, period: int, is_overtime: bool = False, is_shootout: bool = False) -> str:
        """Format period name using effective timing configuration."""
        return self.effective_timing.format_period_name(period, is_overtime, is_shootout)

    def get_start_term(self) -> str:
        """Get the game start term using effective terminology."""
        return self.effective_terminology.get_start_term()

    def parse_game_state(self, state_string: str) -> GameState:
        """
        Parse a game state string to GameState enum.

        Args:
            state_string: State string from API (e.g., "pre", "in", "post")

        Returns:
            GameState enum value
        """
        state_lower = state_string.lower()
        if state_lower in ["pre", "pregame", "scheduled"]:
            return GameState.PRE
        elif state_lower in ["post", "final", "finished", "complete"]:
            return GameState.FINAL
        else:
            return GameState.LIVE

    def is_league_active(self, check_date: Optional[date] = None) -> bool:
        """Check if the league is currently in season."""
        return self.league.is_active(check_date)


class CachedLeagueClient(LeagueClient):
    """League client with caching capabilities."""

    def __init__(self, league: LeagueConfig, sport: SportConfig, cache_dir: str = "cache"):
        super().__init__(league, sport)
        self.cache_dir = cache_dir
        self._setup_cache()

    def _setup_cache(self):
        """Setup cache directory structure."""
        from pathlib import Path
        cache_path = Path(self.cache_dir) / self.league.code
        cache_path.mkdir(parents=True, exist_ok=True)
        self.cache_path = cache_path

    def _get_cache_key(self, target_date: date) -> str:
        """Generate cache key for a date."""
        return f"games_{target_date.strftime('%Y%m%d')}"

    def _load_from_cache(self, cache_key: str) -> Optional[List[LeagueGameSnapshot]]:
        """Load games from cache if available and not expired."""
        import json
        import time
        from pathlib import Path

        cache_file = self.cache_path / f"{cache_key}.json"
        if not cache_file.exists():
            return None

        # Check cache age
        cache_age = time.time() - cache_file.stat().st_mtime
        if cache_age > self.league.api.cache_ttl_seconds:
            return None

        try:
            with cache_file.open('r') as f:
                data = json.load(f)
                games = []
                for game_data in data:
                    # Reconstruct complex objects
                    sport = SportConfig(**game_data['sport']) if 'sport' in game_data else self.sport
                    league = LeagueConfig(**game_data['league']) if 'league' in game_data else self.league

                    # Parse datetime
                    start_time = datetime.fromisoformat(game_data['start_time_local'])

                    # Reconstruct team sides
                    home = TeamSide(**game_data['home'])
                    away = TeamSide(**game_data['away'])

                    # Reconstruct game state
                    state = GameState(game_data['state']) if isinstance(game_data['state'], str) else GameState(**game_data['state'])

                    game = LeagueGameSnapshot(
                        sport=sport,
                        league=league,
                        event_id=game_data['event_id'],
                        start_time_local=start_time,
                        state=state,
                        home=home,
                        away=away,
                        current_period=game_data['current_period'],
                        period_name=game_data['period_name'],
                        display_clock=game_data['display_clock'],
                        seconds_to_start=game_data.get('seconds_to_start', -1),
                        status_detail=game_data.get('status_detail', ''),
                        sport_specific_data=game_data.get('sport_specific_data', {})
                    )
                    games.append(game)
                logger.debug(f"Loaded {len(games)} games from cache")
                return games
        except Exception as e:
            logger.warning(f"Failed to load cache: {e}")
            return None

    def _save_to_cache(self, cache_key: str, games: List[LeagueGameSnapshot]):
        """Save games to cache."""
        import json
        cache_file = self.cache_path / f"{cache_key}.json"

        # Ensure cache directory exists
        self.cache_path.mkdir(parents=True, exist_ok=True)

        try:
            data = []
            for game in games:
                game_dict = {
                    'sport': asdict(game.sport),
                    'league': asdict(game.league),
                    'event_id': game.event_id,
                    'start_time_local': game.start_time_local.isoformat(),
                    'state': game.state.value if hasattr(game.state, 'value') else str(game.state),
                    'home': asdict(game.home),
                    'away': asdict(game.away),
                    'current_period': game.current_period,
                    'period_name': game.period_name,
                    'display_clock': game.display_clock,
                    'seconds_to_start': game.seconds_to_start,
                    'status_detail': game.status_detail,
                    'sport_specific_data': game.sport_specific_data
                }
                data.append(game_dict)

            with cache_file.open('w') as f:
                json.dump(data, f, indent=2, default=str)

            logger.debug(f"Saved {len(games)} games to cache")
        except Exception as e:
            logger.warning(f"Failed to save cache: {e}")