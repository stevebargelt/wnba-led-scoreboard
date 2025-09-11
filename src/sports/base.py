"""
Base classes and interfaces for multi-sport support.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import Dict, List, Optional, Any

from src.model.game import TeamSide, GameState


class SportType(Enum):
    """Supported sports types."""
    WNBA = "wnba"
    NHL = "nhl"
    NBA = "nba"      # Future
    MLB = "mlb"      # Future  
    NFL = "nfl"      # Future


@dataclass
class SportGameSnapshot:
    """Universal game snapshot that works across all sports."""
    
    # Core game information
    sport: SportType
    event_id: str
    start_time_local: datetime
    state: GameState
    home: TeamSide
    away: TeamSide
    
    # Universal timing information
    current_period: int
    period_name: str              # "Q1", "P2", "T9", "4th", etc.
    display_clock: str
    seconds_to_start: int = -1
    status_detail: str = ""
    
    # Sport-specific extensions (flexible data)
    sport_specific_data: Dict[str, Any] = field(default_factory=dict)
    
    # Priority calculation (used by conflict resolution)
    priority_score: float = 0.0


@dataclass 
class SportClientInfo:
    """Information about a sport client implementation."""
    sport_type: SportType
    name: str
    api_base_url: str
    default_cache_ttl: int
    supports_live_updates: bool = True
    supports_schedules: bool = True
    rate_limit_per_minute: Optional[int] = None


class SportClient(ABC):
    """Abstract base class for sport-specific API clients."""
    
    @abstractmethod
    def get_sport_info(self) -> SportClientInfo:
        """Get information about this sport client."""
        pass
    
    @abstractmethod
    def fetch_games(self, target_date: date) -> List[SportGameSnapshot]:
        """
        Fetch games for the target date.
        
        Args:
            target_date: Date to fetch games for
            
        Returns:
            List of SportGameSnapshot objects for that date
        """
        pass
    
    @abstractmethod
    def fetch_team_info(self) -> List[Dict[str, Any]]:
        """
        Fetch team information for this sport.
        
        Returns:
            List of team dictionaries with id, name, abbreviation, colors, etc.
        """
        pass
    
    def get_cache_key_prefix(self) -> str:
        """Get cache key prefix for this sport."""
        return self.get_sport_info().sport_type.value
    
    def supports_feature(self, feature: str) -> bool:
        """Check if this sport client supports a specific feature."""
        info = self.get_sport_info()
        if feature == "live_updates":
            return info.supports_live_updates
        elif feature == "schedules":
            return info.supports_schedules
        return False


class SportRenderer(ABC):
    """Abstract base class for sport-specific rendering."""
    
    @abstractmethod
    def get_period_display(self, game: SportGameSnapshot) -> str:
        """Get sport-appropriate period/quarter display."""
        pass
    
    @abstractmethod
    def get_clock_format(self, game: SportGameSnapshot) -> str:
        """Get sport-appropriate clock format.""" 
        pass
    
    @abstractmethod
    def requires_special_layout(self, game: SportGameSnapshot) -> bool:
        """Check if this game requires sport-specific layout adaptations."""
        pass
    
    def get_status_indicators(self, game: SportGameSnapshot) -> List[str]:
        """Get sport-specific status indicators (overtime, power play, etc.)."""
        return []


@dataclass
class SportAssetInfo:
    """Information about sport-specific assets."""
    sport: SportType
    teams_data_file: str
    logos_directory: str
    logo_variants: List[str]
    primary_color_field: str = "primaryColor"
    secondary_color_field: str = "secondaryColor"


class SportAssetManager(ABC):
    """Abstract base class for managing sport-specific assets."""
    
    @abstractmethod
    def get_asset_info(self) -> SportAssetInfo:
        """Get information about this sport's assets."""
        pass
    
    @abstractmethod
    def fetch_teams_and_assets(self) -> bool:
        """
        Fetch team data and assets from the sport's official sources.
        
        Returns:
            True if successful, False otherwise
        """
        pass
    
    @abstractmethod
    def validate_assets(self, team_ids: List[str]) -> Dict[str, bool]:
        """
        Validate that assets exist for the given team IDs.
        
        Args:
            team_ids: List of team IDs to validate
            
        Returns:
            Dictionary mapping team_id -> asset_exists
        """
        pass


def convert_legacy_game_to_sport_game(
    legacy_game: Any,  # GameSnapshot from existing system
    sport: SportType
) -> SportGameSnapshot:
    """
    Convert legacy GameSnapshot to SportGameSnapshot.
    
    This provides backward compatibility during migration.
    """
    from src.model.game import GameSnapshot  # Avoid circular import
    
    if not isinstance(legacy_game, GameSnapshot):
        raise ValueError(f"Expected GameSnapshot, got {type(legacy_game)}")
    
    # Map sport-specific period naming
    period_name = _get_period_name_for_sport(sport, legacy_game.period)
    
    return SportGameSnapshot(
        sport=sport,
        event_id=legacy_game.event_id,
        start_time_local=legacy_game.start_time_local,
        state=legacy_game.state,
        home=legacy_game.home,
        away=legacy_game.away,
        current_period=legacy_game.period,
        period_name=period_name,
        display_clock=legacy_game.display_clock,
        seconds_to_start=legacy_game.seconds_to_start,
        status_detail=legacy_game.status_detail,
    )


def _get_period_name_for_sport(sport: SportType, period: int) -> str:
    """Get sport-appropriate period name."""
    if sport in [SportType.WNBA, SportType.NBA]:
        if period <= 4:
            return f"Q{period}"
        else:
            return f"OT{period - 4}" if period > 5 else "OT"
    elif sport == SportType.NHL:
        if period <= 3:
            return f"P{period}"
        elif period == 4:
            return "OT"
        else:
            return "SO"  # Shootout
    elif sport == SportType.MLB:
        if period <= 9:
            return f"T{period}" if period <= 9 else f"E{period - 9}"
        else:
            return f"E{period - 9}"
    elif sport == SportType.NFL:
        if period <= 4:
            return f"Q{period}"
        else:
            return "OT"
    
    return f"{period}"  # Fallback


def get_default_sport_priorities() -> List[SportType]:
    """Get default sport priority order."""
    return [
        SportType.WNBA,
        SportType.NHL,
        SportType.NBA,
        SportType.MLB, 
        SportType.NFL,
    ]