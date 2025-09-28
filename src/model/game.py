from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from typing import Optional, Dict, Any


class GameState(Enum):
    PRE = auto()
    LIVE = auto()
    FINAL = auto()


@dataclass
class TeamSide:
    """Team information with extended metadata."""
    id: Optional[str]
    name: str
    abbr: str
    score: int = 0

    # Extended metadata (from SportTeam)
    colors: Dict[str, str] = field(default_factory=dict)
    logo_url: Optional[str] = None
    conference: Optional[str] = None
    division: Optional[str] = None


@dataclass
class GameSnapshot:
    """Unified game snapshot with full sport/league context."""

    # Sport/League Context (REQUIRED - no longer optional)
    sport: 'SportConfig'  # Forward reference, will be imported by consumers
    league: 'LeagueConfig'  # Forward reference, will be imported by consumers

    # Core Identification
    event_id: str
    start_time_local: datetime
    state: GameState

    # Team Information (enhanced)
    home: TeamSide
    away: TeamSide

    # Timing Information (unified)
    current_period: int
    period_name: str  # "Q1", "P2", "OT", etc.
    display_clock: str
    seconds_to_start: int = -1

    # Status
    status_detail: str = ""

    # Sport-Specific Data
    sport_specific_data: Dict[str, Any] = field(default_factory=dict)

    # Legacy compatibility property
    @property
    def period(self) -> int:
        """Backward compatibility for legacy code expecting 'period' field."""
        return self.current_period

