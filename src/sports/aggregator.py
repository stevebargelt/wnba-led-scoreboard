"""
Multi-sport game aggregation and priority resolution system.
"""

import os
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum

from src.model.sport_game import EnhancedGameSnapshot, SportTeam
from src.model.game import GameState
from src.sports.base import SportType, SportClient
from src.sports.wnba import WNBAClient
from src.sports.nhl import NHLClient


class ConflictResolution(Enum):
    """Strategies for resolving conflicts between multiple active games."""
    PRIORITY = "priority"        # Use sport priority order
    LIVE_FIRST = "live_first"    # Always prefer live games regardless of sport
    MANUAL = "manual"            # Require manual selection via web admin


@dataclass
class SportPriorityRule:
    """Configuration for sport priority and boosting rules."""
    sport_priorities: List[SportType]
    live_game_boost: bool = True
    favorite_team_boost: bool = True
    close_game_boost: bool = True          # Boost games with small score differential
    playoff_boost: bool = True             # Boost playoff/championship games
    conflict_resolution: ConflictResolution = ConflictResolution.PRIORITY


class MultiSportAggregator:
    """Aggregates games from multiple sports and resolves display priorities."""
    
    def __init__(self, sport_priorities: List[SportType], enabled_sports: Optional[List[SportType]] = None):
        self.sport_priorities = sport_priorities
        self.enabled_sports = enabled_sports or sport_priorities
        
        # Initialize sport clients
        self.sport_clients: Dict[SportType, SportClient] = {}
        self._initialize_sport_clients()
        
        # Priority configuration
        self.priority_rules = SportPriorityRule(sport_priorities=sport_priorities)
        
        # Conflict tracking
        self._last_conflict_resolution: Optional[Dict[str, Any]] = None
        self._manual_override: Optional[Tuple[str, datetime]] = None  # (event_id, expires_at)
        
    def _initialize_sport_clients(self) -> None:
        """Initialize available sport clients."""
        # Only initialize clients for enabled sports
        if SportType.WNBA in self.enabled_sports:
            self.sport_clients[SportType.WNBA] = WNBAClient()
        
        if SportType.NHL in self.enabled_sports:
            self.sport_clients[SportType.NHL] = NHLClient()
        
        # Future sports will be added here
        # if SportType.NBA in self.enabled_sports:
        #     self.sport_clients[SportType.NBA] = NBAClient()
    
    def get_featured_game(
        self,
        target_date: date,
        now_local: datetime,
        favorite_teams: Dict[SportType, List[str]] = None
    ) -> Optional[EnhancedGameSnapshot]:
        """
        Get the highest priority game across all enabled sports.
        
        Args:
            target_date: Date to fetch games for
            now_local: Current local time for priority calculations
            favorite_teams: Dictionary of sport -> list of favorite team names/IDs
            
        Returns:
            Highest priority game or None if no games available
        """
        favorite_teams = favorite_teams or {}
        
        # Check for manual override first
        if self._is_manual_override_active():
            override_game = self._get_manual_override_game(target_date)
            if override_game:
                return override_game
        
        # Fetch games from all enabled sports
        all_games = self._fetch_all_games(target_date)
        
        if not all_games:
            return None
        
        # Filter to today's games
        today_games = [
            game for game in all_games 
            if game.start_time_local.astimezone(now_local.tzinfo).date() == now_local.date()
        ]
        
        if not today_games:
            return None
        
        # Calculate priority scores for all games
        scored_games = self._calculate_game_priorities(today_games, now_local, favorite_teams)
        
        # Select highest priority game
        if not scored_games:
            return None
        
        chosen_game = max(scored_games, key=lambda g: g.priority_score)
        
        # Record conflict resolution details for debugging/UI
        self._record_conflict_resolution(scored_games, chosen_game, now_local)
        
        return chosen_game
    
    def _fetch_all_games(self, target_date: date) -> List[EnhancedGameSnapshot]:
        """Fetch games from all enabled sport clients."""
        all_games = []
        
        for sport_type, client in self.sport_clients.items():
            try:
                sport_games = client.fetch_games(target_date)
                all_games.extend(sport_games)
                print(f"[info] Fetched {len(sport_games)} {sport_type.value.upper()} games")
            except Exception as e:
                print(f"[warn] Failed to fetch {sport_type.value.upper()} games: {e}")
                continue
        
        return all_games
    
    def _calculate_game_priorities(
        self,
        games: List[EnhancedGameSnapshot],
        now_local: datetime,
        favorite_teams: Dict[SportType, List[str]]
    ) -> List[EnhancedGameSnapshot]:
        """Calculate priority scores for all games."""
        scored_games = []
        
        for game in games:
            # Start with base sport priority
            sport_priority_index = self._get_sport_priority_index(game.sport)
            base_score = (len(self.sport_priorities) - sport_priority_index) * 1000
            
            # Apply boosting rules
            if self.priority_rules.live_game_boost and game.state == GameState.LIVE:
                base_score += 500
            
            if self.priority_rules.favorite_team_boost:
                if self._is_favorite_game(game, favorite_teams.get(game.sport, [])):
                    base_score += 200
            
            if self.priority_rules.close_game_boost and game.state == GameState.LIVE:
                score_diff = game.get_score_differential()
                if score_diff <= 3:  # Close game
                    base_score += 100
                elif score_diff <= 7:  # Somewhat close
                    base_score += 50
            
            # Time-based adjustments
            if game.state == GameState.PRE:
                # Boost games starting soon
                if 0 <= game.seconds_to_start <= 300:  # 5 minutes
                    base_score += 150
                elif 0 <= game.seconds_to_start <= 900:  # 15 minutes
                    base_score += 75
            elif game.state == GameState.FINAL:
                # Reduce priority for completed games
                base_score -= 100
            
            # Special situations boost
            if game.timing.is_overtime:
                base_score += 300  # Overtime is exciting!
            
            if game.timing.is_shootout:
                base_score += 400  # Shootouts are very exciting!
            
            # Set the calculated priority
            game.priority_score = base_score
            game.selection_reason = self._build_selection_reason(game, base_score)
            scored_games.append(game)
        
        return scored_games
    
    def _get_sport_priority_index(self, sport: SportType) -> int:
        """Get the priority index for a sport (lower index = higher priority)."""
        try:
            return self.sport_priorities.index(sport)
        except ValueError:
            return len(self.sport_priorities)  # Lowest priority for unknown sports
    
    def _is_favorite_game(self, game: EnhancedGameSnapshot, favorite_team_identifiers: List[str]) -> bool:
        """Check if game involves a favorite team."""
        if not favorite_team_identifiers:
            return False
        
        # Normalize identifiers for comparison and drop None entries
        favorites_lower = [str(fav).lower() for fav in favorite_team_identifiers if fav]
        
        # Check team ID, name, and abbreviation
        def _normalize(value: Optional[str]) -> Optional[str]:
            return value.lower() if isinstance(value, str) else (str(value).lower() if value is not None else None)

        home_matches = (
            (game.home.id and _normalize(game.home.id) in favorites_lower)
            or (_normalize(game.home.name) in favorites_lower if game.home.name else False)
            or (_normalize(game.home.abbr) in favorites_lower if game.home.abbr else False)
        )

        away_matches = (
            (game.away.id and _normalize(game.away.id) in favorites_lower)
            or (_normalize(game.away.name) in favorites_lower if game.away.name else False)
            or (_normalize(game.away.abbr) in favorites_lower if game.away.abbr else False)
        )
        
        is_favorite = home_matches or away_matches
        if is_favorite:
            game.is_favorite_game = True
        
        return is_favorite
    
    def _build_selection_reason(self, game: EnhancedGameSnapshot, score: float) -> str:
        """Build human-readable reason for why game was selected."""
        reasons = []
        
        # Sport priority
        sport_priority = self._get_sport_priority_index(game.sport) + 1
        reasons.append(f"{game.sport.value.upper()} priority #{sport_priority}")
        
        # Game state boost
        if game.state == GameState.LIVE:
            reasons.append("LIVE game boost")
        
        # Favorite team boost
        if game.is_favorite_game:
            reasons.append("favorite team")
        
        # Special situations
        if game.timing.is_overtime:
            reasons.append("OVERTIME")
        elif game.timing.is_shootout:
            reasons.append("SHOOTOUT")
        
        # Close game
        if game.state == GameState.LIVE and game.get_score_differential() <= 3:
            reasons.append("close game")
        
        # Time to start
        if game.state == GameState.PRE and 0 <= game.seconds_to_start <= 300:
            reasons.append("starting soon")
        
        base_reason = f"Priority score: {score:.0f}"
        if reasons:
            base_reason += f" ({', '.join(reasons)})"
        
        return base_reason
    
    def _record_conflict_resolution(
        self,
        all_games: List[EnhancedGameSnapshot],
        chosen_game: EnhancedGameSnapshot,
        now_local: datetime
    ) -> None:
        """Record details about conflict resolution for debugging/UI."""
        conflicts = [g for g in all_games if g.priority_score > 0]
        conflicts.sort(key=lambda g: g.priority_score, reverse=True)
        
        self._last_conflict_resolution = {
            "timestamp": now_local.isoformat(),
            "total_games": len(all_games),
            "today_games": len(conflicts),
            "chosen_game": {
                "sport": chosen_game.sport.value,
                "event_id": chosen_game.event_id,
                "matchup": f"{chosen_game.away.abbr} @ {chosen_game.home.abbr}",
                "state": chosen_game.state.name,
                "priority_score": chosen_game.priority_score,
                "reason": chosen_game.selection_reason,
            },
            "alternatives": [
                {
                    "sport": game.sport.value,
                    "matchup": f"{game.away.abbr} @ {game.home.abbr}",
                    "state": game.state.name,
                    "priority_score": game.priority_score,
                    "reason": game.selection_reason,
                }
                for game in conflicts[:5]  # Top 5 alternatives
            ]
        }
    
    def set_manual_override(self, event_id: str, duration_minutes: int = 60) -> bool:
        """
        Set manual override to show specific game.
        
        Args:
            event_id: Game event ID to override to
            duration_minutes: How long override should last
            
        Returns:
            True if override was set successfully
        """
        expires_at = datetime.now() + timedelta(minutes=duration_minutes)
        self._manual_override = (event_id, expires_at)
        print(f"[info] Manual override set for game {event_id} until {expires_at}")
        return True
    
    def clear_manual_override(self) -> None:
        """Clear any active manual override."""
        self._manual_override = None
        print("[info] Manual override cleared")
    
    def _is_manual_override_active(self) -> bool:
        """Check if manual override is currently active."""
        if not self._manual_override:
            return False
        
        event_id, expires_at = self._manual_override
        if datetime.now() > expires_at:
            print(f"[info] Manual override for {event_id} expired")
            self._manual_override = None
            return False
        
        return True
    
    def _get_manual_override_game(self, target_date: date) -> Optional[EnhancedGameSnapshot]:
        """Get the manually overridden game if it exists."""
        if not self._manual_override:
            return None
        
        event_id, _ = self._manual_override
        
        # Find the game in today's games
        all_games = self._fetch_all_games(target_date)
        for game in all_games:
            if game.event_id == event_id:
                game.selection_reason = "MANUAL OVERRIDE"
                game.priority_score = 999999  # Highest possible priority
                return game
        
        print(f"[warn] Manual override game {event_id} not found in today's games")
        return None
    
    def update_sport_priorities(self, new_priorities: List[SportType]) -> None:
        """Update sport priority order."""
        self.sport_priorities = new_priorities
        self.priority_rules.sport_priorities = new_priorities
        print(f"[info] Updated sport priorities: {[s.value for s in new_priorities]}")
    
    def configure_priority_rules(self, **kwargs) -> None:
        """Update priority rule configuration."""
        if "live_game_boost" in kwargs:
            self.priority_rules.live_game_boost = bool(kwargs["live_game_boost"])
        if "favorite_team_boost" in kwargs:
            self.priority_rules.favorite_team_boost = bool(kwargs["favorite_team_boost"])
        if "close_game_boost" in kwargs:
            self.priority_rules.close_game_boost = bool(kwargs["close_game_boost"])
        if "playoff_boost" in kwargs:
            self.priority_rules.playoff_boost = bool(kwargs["playoff_boost"])
        if "conflict_resolution" in kwargs:
            resolution = kwargs["conflict_resolution"]
            if isinstance(resolution, str):
                self.priority_rules.conflict_resolution = ConflictResolution(resolution)
            else:
                self.priority_rules.conflict_resolution = resolution
    
    def get_all_todays_games(self, target_date: date, now_local: datetime) -> List[EnhancedGameSnapshot]:
        """Get all games for today across all sports, sorted by priority."""
        all_games = self._fetch_all_games(target_date)
        
        # Filter to today's games
        today_games = [
            game for game in all_games
            if game.start_time_local.astimezone(now_local.tzinfo).date() == now_local.date()
        ]
        
        # Calculate priorities but don't select just one
        scored_games = self._calculate_game_priorities(today_games, now_local, {})
        
        # Sort by priority score
        scored_games.sort(key=lambda g: g.priority_score, reverse=True)
        
        return scored_games
    
    def get_sport_status(self) -> Dict[str, Any]:
        """Get status information for all sport clients."""
        status = {
            "aggregator": {
                "enabled_sports": [s.value for s in self.enabled_sports],
                "sport_priorities": [s.value for s in self.sport_priorities],
                "manual_override_active": self._is_manual_override_active(),
                "last_conflict_resolution": self._last_conflict_resolution,
            },
            "sports": {}
        }
        
        for sport_type, client in self.sport_clients.items():
            try:
                status["sports"][sport_type.value] = client.get_status()
            except Exception as e:
                status["sports"][sport_type.value] = {"error": str(e)}
        
        return status
    
    def clear_all_caches(self, max_age_hours: Optional[int] = 24) -> Dict[str, int]:
        """Clear caches for all sport clients."""
        results = {}
        
        for sport_type, client in self.sport_clients.items():
            try:
                cleared = client.clear_cache(max_age_hours)
                results[sport_type.value] = cleared
                print(f"[info] Cleared {cleared} {sport_type.value.upper()} cache files")
            except Exception as e:
                print(f"[warn] Failed to clear {sport_type.value.upper()} cache: {e}")
                results[sport_type.value] = 0
        
        return results
    
    def enable_sport(self, sport: SportType) -> bool:
        """Enable a sport and initialize its client."""
        if sport in self.enabled_sports:
            return True  # Already enabled
        
        try:
            # Initialize client for this sport
            if sport == SportType.WNBA:
                self.sport_clients[sport] = WNBAClient()
            elif sport == SportType.NHL:
                self.sport_clients[sport] = NHLClient()
            # Future sports...
            else:
                print(f"[warn] Sport {sport.value} not yet implemented")
                return False
            
            self.enabled_sports.append(sport)
            print(f"[info] Enabled {sport.value.upper()} sport")
            return True
            
        except Exception as e:
            print(f"[error] Failed to enable {sport.value.upper()}: {e}")
            return False
    
    def disable_sport(self, sport: SportType) -> None:
        """Disable a sport and remove its client."""
        if sport in self.enabled_sports:
            self.enabled_sports.remove(sport)
        
        if sport in self.sport_clients:
            del self.sport_clients[sport]
        
        print(f"[info] Disabled {sport.value.upper()} sport")


# Legacy compatibility function
def get_legacy_featured_game(
    aggregator: MultiSportAggregator,
    target_date: date, 
    now_local: datetime,
    favorite_teams: Dict[SportType, List[str]] = None
):
    """
    Legacy compatibility wrapper that returns old GameSnapshot format.
    
    This allows existing code to work unchanged during migration.
    """
    enhanced_game = aggregator.get_featured_game(target_date, now_local, favorite_teams)
    
    if enhanced_game is None:
        return None
    
    return enhanced_game.to_legacy_game_snapshot()
