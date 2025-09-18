"""League configuration models."""

from dataclasses import dataclass, field
from datetime import date
from typing import Optional, Dict, Any, List, Type

from .sport_config import TimingConfig, ScoringConfig, TerminologyConfig


@dataclass
class LeagueAPIConfig:
    """League-specific API configuration."""
    base_url: str
    endpoints: Dict[str, str]
    rate_limit_per_minute: int = 60
    cache_ttl_seconds: int = 300
    headers: Dict[str, str] = field(default_factory=dict)


@dataclass
class LeagueSeason:
    """League season information."""
    start_date: date
    end_date: date
    playoff_start: Optional[date] = None
    is_active: bool = True

    def is_in_season(self, check_date: date) -> bool:
        """Check if a date falls within the season."""
        return self.start_date <= check_date <= self.end_date

    def is_playoffs(self, check_date: date) -> bool:
        """Check if a date is during playoffs."""
        if self.playoff_start is None:
            return False
        return self.playoff_start <= check_date <= self.end_date


@dataclass
class LeagueConfig:
    """League-specific configuration with sport overrides."""
    name: str
    code: str  # e.g., "nhl", "wnba"
    sport_code: str  # Reference to parent sport

    # API configuration
    api: LeagueAPIConfig

    # Season information
    current_season: Optional[LeagueSeason] = None

    # Optional overrides of sport-level configurations
    timing_overrides: Optional[Dict[str, Any]] = None
    scoring_overrides: Optional[Dict[str, Any]] = None
    terminology_overrides: Optional[Dict[str, Any]] = None

    # League-specific data
    team_count: int = 0
    conference_structure: Optional[Dict[str, List[str]]] = None

    # Asset information
    team_assets_url: Optional[str] = None
    logo_url_template: Optional[str] = None  # e.g., "https://example.com/logos/{team_id}.svg"

    def get_effective_timing(self, sport_timing: TimingConfig) -> TimingConfig:
        """Merge sport timing with league overrides."""
        if not self.timing_overrides:
            return sport_timing

        # Create copy and apply overrides
        import copy
        effective = copy.deepcopy(sport_timing)
        for key, value in self.timing_overrides.items():
            if hasattr(effective, key):
                setattr(effective, key, value)
        return effective

    def get_effective_scoring(self, sport_scoring: ScoringConfig) -> ScoringConfig:
        """Merge sport scoring with league overrides."""
        if not self.scoring_overrides:
            return sport_scoring

        import copy
        effective = copy.deepcopy(sport_scoring)
        for key, value in self.scoring_overrides.items():
            if hasattr(effective, key):
                setattr(effective, key, value)
        return effective

    def get_effective_terminology(self, sport_terminology: TerminologyConfig) -> TerminologyConfig:
        """Merge sport terminology with league overrides."""
        if not self.terminology_overrides:
            return sport_terminology

        import copy
        effective = copy.deepcopy(sport_terminology)
        for key, value in self.terminology_overrides.items():
            if hasattr(effective, key):
                setattr(effective, key, value)
        return effective

    def is_active(self, check_date: Optional[date] = None) -> bool:
        """Check if league is currently active."""
        if self.current_season is None:
            return True  # Assume active if no season info

        if check_date is None:
            from datetime import date as date_cls
            check_date = date_cls.today()

        return self.current_season.is_in_season(check_date)