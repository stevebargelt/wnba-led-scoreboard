"""
Multi-sport configuration types and structures.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from zoneinfo import ZoneInfo
from typing import List, Optional, Dict, Any, Union

from src.sports.base import SportType
from src.config.types import MatrixConfig, RefreshConfig, RenderConfig, FavoriteTeam


@dataclass
class SportFavorites:
    """Favorite teams configuration for a specific sport."""
    sport: SportType
    enabled: bool = True
    priority: int = 1                    # Lower number = higher priority
    teams: List[FavoriteTeam] = field(default_factory=list)


@dataclass
class SportPriorityConfig:
    """Configuration for resolving conflicts between multiple sports."""
    conflict_resolution: str = "priority"    # "priority", "live_first", "manual"
    live_game_boost: bool = True             # Boost live games over pre/final
    favorite_team_boost: bool = True         # Boost games with favorite teams
    close_game_boost: bool = True            # Boost games with small score differential
    playoff_boost: bool = True               # Boost playoff/championship games
    
    # Manual override settings
    manual_override_duration_minutes: int = 60
    auto_clear_override_on_game_end: bool = True


@dataclass
class MultiSportAppConfig:
    """Multi-sport application configuration."""
    
    # Required fields first
    sports: List[SportFavorites]
    timezone: str
    matrix: MatrixConfig
    refresh: RefreshConfig
    
    # Optional fields with defaults
    sport_priority: SportPriorityConfig = field(default_factory=SportPriorityConfig)
    render: RenderConfig = field(default_factory=RenderConfig)
    tz: Optional[ZoneInfo] = None
    enabled_sports: List[SportType] = field(default_factory=list)
    default_sport: Optional[SportType] = None
    
    def get_enabled_sports(self) -> List[SportType]:
        """Get list of currently enabled sports."""
        if self.enabled_sports:
            return self.enabled_sports
        
        # Fallback: get enabled sports from sports configuration
        return [sport_config.sport for sport_config in self.sports if sport_config.enabled]
    
    def get_sport_priorities(self) -> List[SportType]:
        """Get sport priority order (highest to lowest priority)."""
        enabled_sports = [s for s in self.sports if s.enabled]
        enabled_sports.sort(key=lambda s: s.priority)
        return [s.sport for s in enabled_sports]
    
    def get_favorites_for_sport(self, sport: SportType) -> List[FavoriteTeam]:
        """Get favorite teams for a specific sport."""
        for sport_config in self.sports:
            if sport_config.sport == sport:
                return sport_config.teams
        return []
    
    def is_sport_enabled(self, sport: SportType) -> bool:
        """Check if a sport is enabled."""
        for sport_config in self.sports:
            if sport_config.sport == sport:
                return sport_config.enabled
        return False
    
    def get_sport_priority(self, sport: SportType) -> int:
        """Get priority level for a sport (lower = higher priority)."""
        for sport_config in self.sports:
            if sport_config.sport == sport:
                return sport_config.priority
        return 999  # Lowest priority for unknown sports


@dataclass  
class LegacyAppConfig:
    """Legacy single-sport configuration for backward compatibility."""
    favorites: List[FavoriteTeam]
    timezone: str
    matrix: MatrixConfig
    refresh: RefreshConfig
    render: RenderConfig = field(default_factory=RenderConfig)
    tz: Optional[ZoneInfo] = None


def migrate_legacy_config_to_multi_sport(legacy_config: LegacyAppConfig) -> MultiSportAppConfig:
    """
    Migrate legacy single-sport configuration to multi-sport format.
    
    This ensures backward compatibility for existing WNBA-only setups.
    """
    # Create WNBA sport configuration from legacy favorites
    wnba_sport_config = SportFavorites(
        sport=SportType.WNBA,
        enabled=True,
        priority=1,  # Highest priority
        teams=legacy_config.favorites
    )
    
    return MultiSportAppConfig(
        sports=[wnba_sport_config],
        sport_priority=SportPriorityConfig(),
        timezone=legacy_config.timezone,
        matrix=legacy_config.matrix,
        refresh=legacy_config.refresh,
        render=legacy_config.render,
        tz=legacy_config.tz,
        enabled_sports=[SportType.WNBA],
        default_sport=SportType.WNBA,
    )


def convert_multi_sport_to_legacy(multi_config: MultiSportAppConfig) -> LegacyAppConfig:
    """
    Convert multi-sport config back to legacy format.
    
    Uses the highest priority enabled sport (typically WNBA for backward compatibility).
    """
    # Find the highest priority enabled sport
    enabled_sports = [s for s in multi_config.sports if s.enabled]
    if not enabled_sports:
        # No sports enabled, use WNBA as default
        favorites = []
    else:
        # Use highest priority sport
        highest_priority_sport = min(enabled_sports, key=lambda s: s.priority)
        favorites = highest_priority_sport.teams
    
    return LegacyAppConfig(
        favorites=favorites,
        timezone=multi_config.timezone,
        matrix=multi_config.matrix, 
        refresh=multi_config.refresh,
        render=multi_config.render,
        tz=multi_config.tz,
    )


def detect_config_format(config_data: Dict[str, Any]) -> str:
    """
    Detect whether configuration is legacy or multi-sport format.
    
    Returns:
        "legacy" or "multi_sport"
    """
    if "sports" in config_data:
        return "multi_sport"
    elif "favorites" in config_data:
        return "legacy" 
    else:
        return "unknown"


def create_default_multi_sport_config(timezone: str = "America/Los_Angeles") -> MultiSportAppConfig:
    """Create a default multi-sport configuration."""
    # Default WNBA configuration
    wnba_config = SportFavorites(
        sport=SportType.WNBA,
        enabled=True,
        priority=1,
        teams=[
            FavoriteTeam(name="Seattle Storm", id="18", abbr="SEA"),
        ]
    )
    
    # Default NHL configuration (disabled by default)
    nhl_config = SportFavorites(
        sport=SportType.NHL,
        enabled=False,
        priority=2,
        teams=[
            FavoriteTeam(name="Seattle Kraken", id="55", abbr="SEA"),
        ]
    )
    
    return MultiSportAppConfig(
        sports=[wnba_config, nhl_config],
        sport_priority=SportPriorityConfig(),
        timezone=timezone,
        matrix=MatrixConfig(width=64, height=32),
        refresh=RefreshConfig(),
        render=RenderConfig(),
        enabled_sports=[SportType.WNBA],
        default_sport=SportType.WNBA,
    )