"""
League-based game aggregation and priority resolution system.
"""

import os
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum

from src.model.game import GameSnapshot, GameState
from .registry import registry


class ConflictResolution(Enum):
    """Strategies for resolving conflicts between multiple active games."""
    PRIORITY = "priority"        # Use league priority order
    LIVE_FIRST = "live_first"    # Always prefer live games regardless of league
    MANUAL = "manual"            # Require manual selection via web admin


@dataclass
class LeaguePriorityRule:
    """Configuration for league priority and boosting rules."""
    league_priorities: List[str]  # List of league codes in priority order
    live_game_boost: bool = True
    favorite_team_boost: bool = True
    close_game_boost: bool = True          # Boost games with small score differential
    playoff_boost: bool = True             # Boost playoff/championship games
    conflict_resolution: ConflictResolution = ConflictResolution.PRIORITY


class LeagueAggregator:
    """Aggregates games from multiple leagues and resolves display priorities."""

    def __init__(self, league_priorities: List[str], enabled_leagues: Optional[List[str]] = None):
        self.league_priorities = league_priorities
        self.enabled_leagues = enabled_leagues or league_priorities

        # Initialize league clients from registry
        self.league_clients = {}
        self._initialize_league_clients()

        # Priority configuration
        self.priority_rules = LeaguePriorityRule(league_priorities=league_priorities)

        # Conflict tracking
        self._last_conflict_resolution: Optional[Dict[str, Any]] = None
        self._manual_override: Optional[Tuple[str, datetime]] = None  # (event_id, expires_at)

    def _initialize_league_clients(self) -> None:
        """Initialize available league clients from registry."""
        for league_code in self.enabled_leagues:
            league_config = registry.get_league(league_code)
            if not league_config:
                print(f"[warning] League {league_code} not found in registry")
                continue

            sport_config = registry.get_sport(league_config.sport_code)
            if not sport_config:
                print(f"[warning] Sport {league_config.sport_code} not found for league {league_code}")
                continue

            client_class = registry.get_league_client_class(league_code)
            if client_class:
                self.league_clients[league_code] = client_class(league_config, sport_config)
                print(f"[info] Initialized {league_code} client")
            else:
                print(f"[warning] No client implementation for league {league_code}")

    def configure_priority_rules(
        self,
        live_game_boost: bool = True,
        favorite_team_boost: bool = True,
        close_game_boost: bool = True,
        playoff_boost: bool = True,
        conflict_resolution: str = "priority"
    ) -> None:
        """Update priority calculation rules."""
        self.priority_rules.live_game_boost = live_game_boost
        self.priority_rules.favorite_team_boost = favorite_team_boost
        self.priority_rules.close_game_boost = close_game_boost
        self.priority_rules.playoff_boost = playoff_boost

        try:
            self.priority_rules.conflict_resolution = ConflictResolution(conflict_resolution)
        except ValueError:
            print(f"[warning] Invalid conflict resolution: {conflict_resolution}, using 'priority'")
            self.priority_rules.conflict_resolution = ConflictResolution.PRIORITY

    def get_featured_game(
        self,
        target_date: date,
        now_local: datetime,
        favorite_teams: Dict[str, List[str]] = None
    ) -> Optional[GameSnapshot]:
        """
        Get the highest priority game across all enabled leagues.

        Args:
            target_date: Date to fetch games for
            now_local: Current local time for priority calculations
            favorite_teams: Dictionary of league -> list of favorite team names/IDs

        Returns:
            Highest priority game or None if no games available
        """
        favorite_teams = favorite_teams or {}

        # Check for manual override first
        if self._is_manual_override_active():
            override_game = self._get_manual_override_game(target_date)
            if override_game:
                return override_game

        # Fetch games from all enabled leagues
        all_games = []
        for league_code, client in self.league_clients.items():
            try:
                league_games = client.fetch_games(target_date)

                # Calculate priority for each game
                league_favorites = favorite_teams.get(league_code, [])
                for game in league_games:
                    priority = self._calculate_game_priority(
                        game, league_code, now_local, league_favorites
                    )
                    # Store priority in the game object for later use
                    game.sport_specific_data['priority_score'] = priority
                    all_games.append(game)

            except Exception as e:
                print(f"[error] Failed to fetch {league_code} games: {e}")

        if not all_games:
            return None

        # Sort by priority and apply conflict resolution
        all_games.sort(key=lambda g: g.sport_specific_data.get('priority_score', 0), reverse=True)
        return self._apply_conflict_resolution(all_games, now_local)

    def _calculate_game_priority(
        self,
        game: GameSnapshot,
        league_code: str,
        now: datetime,
        favorite_teams: List[str]
    ) -> float:
        """
        Calculate priority score for a game.

        Higher scores mean higher priority.
        """
        # Base priority from league order (100, 99, 98, ...)
        try:
            base_priority = 100 - self.league_priorities.index(league_code)
        except ValueError:
            base_priority = 0

        score = float(base_priority)

        # Live game boost
        if self.priority_rules.live_game_boost and game.state == GameState.LIVE:
            score += 50

        # Favorite team boost
        if self.priority_rules.favorite_team_boost:
            home_name = game.home.name if hasattr(game.home, 'name') else str(game.home.abbr)
            away_name = game.away.name if hasattr(game.away, 'name') else str(game.away.abbr)

            if any(fav in [home_name, away_name] for fav in favorite_teams):
                score += 30

        # Close game boost (only for live games)
        if self.priority_rules.close_game_boost and game.state == GameState.LIVE:
            score_diff = abs(game.home.score - game.away.score)
            if score_diff <= 5:  # Close game threshold
                score += 20 - (score_diff * 2)  # More boost for closer games

        # Playoff/championship boost
        if self.priority_rules.playoff_boost:
            # Check sport-specific data for playoff indicators
            if game.sport_specific_data.get('is_playoff'):
                score += 40
            elif game.sport_specific_data.get('is_championship'):
                score += 60

        # Time proximity boost (games closer to now get slightly higher priority)
        if game.state == GameState.PRE:
            hours_until = (game.start_time_local - now).total_seconds() / 3600
            if 0 <= hours_until <= 3:  # Within 3 hours
                score += 10 * (3 - hours_until) / 3

        return score

    def _apply_conflict_resolution(
        self,
        games: List[GameSnapshot],
        now: datetime
    ) -> Optional[GameSnapshot]:
        """Apply conflict resolution strategy to select final game."""
        if not games:
            return None

        if self.priority_rules.conflict_resolution == ConflictResolution.LIVE_FIRST:
            # Find first live game
            for game in games:
                if game.state == GameState.LIVE:
                    return game

        # Default to highest priority game
        return games[0]

    def _is_manual_override_active(self) -> bool:
        """Check if manual override is currently active."""
        if not self._manual_override:
            return False

        _, expires_at = self._manual_override
        return datetime.now() < expires_at

    def _get_manual_override_game(self, target_date: date) -> Optional[GameSnapshot]:
        """Get the manually overridden game if it exists."""
        if not self._manual_override:
            return None

        event_id, _ = self._manual_override

        # Search for the game in all leagues
        for league_code, client in self.league_clients.items():
            try:
                games = client.fetch_games(target_date)
                for game in games:
                    if game.event_id == event_id:
                        return game
            except Exception:
                continue

        return None

    def set_manual_override(self, event_id: str, duration_hours: float = 4) -> None:
        """Set a manual override to display a specific game."""
        expires_at = datetime.now() + timedelta(hours=duration_hours)
        self._manual_override = (event_id, expires_at)

    def clear_manual_override(self) -> None:
        """Clear any active manual override."""
        self._manual_override = None

    def get_all_games(self, target_date: date) -> Dict[str, List[GameSnapshot]]:
        """
        Get all games for all enabled leagues.

        Returns:
            Dictionary mapping league code to list of games
        """
        games_by_league = {}

        for league_code, client in self.league_clients.items():
            try:
                games = client.fetch_games(target_date)
                games_by_league[league_code] = games
            except Exception as e:
                print(f"[error] Failed to fetch {league_code} games: {e}")
                games_by_league[league_code] = []

        return games_by_league