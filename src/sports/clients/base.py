"""Base classes for league-specific API clients."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, datetime
from typing import List, Optional, Dict, Any

from ..models.league_config import LeagueConfig
from ..models.sport_config import SportConfig, TimingConfig, ScoringConfig, TerminologyConfig
from src.model.game import GameState, TeamSide


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
                # TODO: Deserialize to LeagueGameSnapshot objects
                return None  # Placeholder
        except Exception:
            return None

    def _save_to_cache(self, cache_key: str, games: List[LeagueGameSnapshot]):
        """Save games to cache."""
        import json
        cache_file = self.cache_path / f"{cache_key}.json"
        try:
            # TODO: Serialize LeagueGameSnapshot objects
            data = []  # Placeholder
            with cache_file.open('w') as f:
                json.dump(data, f)
        except Exception:
            pass  # Fail silently on cache write errors