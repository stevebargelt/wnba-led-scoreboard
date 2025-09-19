"""
Enhanced sport-agnostic game models for multi-sport support.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Union

from src.model.game import TeamSide, GameState


@dataclass
class SportTeam:
    """Enhanced team representation with sport context."""
    id: Optional[str]
    name: str
    abbr: str
    score: int = 0
    league_code: Optional[str] = None
    
    # Extended team information
    colors: Dict[str, str] = field(default_factory=dict)  # {"primary": "#hex", "secondary": "#hex"}
    logo_url: Optional[str] = None
    conference: Optional[str] = None
    division: Optional[str] = None
    
    def to_team_side(self) -> TeamSide:
        """Convert to legacy TeamSide for backward compatibility."""
        return TeamSide(
            id=self.id,
            name=self.name,
            abbr=self.abbr,
            score=self.score
        )


@dataclass
class GameTiming:
    """Sport-agnostic game timing information."""
    current_period: int
    period_name: str              # "Q1", "P2", "T9", etc.
    period_max: int               # Maximum periods for this sport (regulation)
    display_clock: str
    clock_running: bool = False
    is_intermission: bool = False
    is_overtime: bool = False
    is_shootout: bool = False     # For NHL
    
    def is_regulation(self) -> bool:
        """Check if game is still in regulation time."""
        return self.current_period <= self.period_max
    
    def get_overtime_type(self) -> Optional[str]:
        """Get the type of overtime if applicable."""
        if not self.is_overtime:
            return None
        
        if self.is_shootout:
            return "shootout"
        elif self.current_period > self.period_max:
            return f"OT{self.current_period - self.period_max}"
        else:
            return "OT"


@dataclass
class SportSituation:
    """Sport-specific game situation information."""
    power_play_active: bool = False       # NHL: power play
    power_play_team: Optional[str] = None # "home" or "away"
    penalty_end_time: Optional[str] = None
    
    # Baseball-specific
    inning_half: Optional[str] = None     # "top" or "bottom"
    outs: Optional[int] = None
    runners_on_base: List[int] = field(default_factory=list)  # [1, 2, 3] for bases occupied
    
    # Football-specific  
    down: Optional[int] = None            # 1st, 2nd, 3rd, 4th down
    distance: Optional[int] = None        # Yards to go
    field_position: Optional[str] = None  # "NYG 35" (team abbreviation + yard line)
    timeouts_left: Dict[str, int] = field(default_factory=dict)  # {"home": 3, "away": 2}


@dataclass
class EnhancedGameSnapshot:
    """Enhanced game snapshot with multi-sport support."""
    
    # Core identification
    league_code: str  # League code like "nhl", "wnba", etc.
    event_id: str
    start_time_local: datetime
    state: GameState
    
    # Team information
    home: SportTeam
    away: SportTeam
    
    # Timing information  
    timing: GameTiming
    
    # Sport-specific situation
    situation: SportSituation = field(default_factory=SportSituation)
    
    # Game metadata
    seconds_to_start: int = -1
    status_detail: str = ""
    venue: Optional[str] = None
    attendance: Optional[int] = None
    
    # Priority and selection
    priority_score: float = 0.0
    is_favorite_game: bool = False
    selection_reason: str = ""           # Why this game was chosen
    
    # Raw data for debugging
    raw_api_data: Dict[str, Any] = field(default_factory=dict)

    @property
    def display_clock(self) -> Optional[str]:
        """Compatibility property for accessing timing.display_clock."""
        return self.timing.display_clock if self.timing else None

    @property
    def period(self) -> int:
        """Compatibility property for accessing timing.current_period."""
        return self.timing.current_period if self.timing else 0

    def to_legacy_game_snapshot(self):
        """Convert to legacy GameSnapshot for backward compatibility."""
        from src.model.game import GameSnapshot

        snapshot = GameSnapshot(
            event_id=self.event_id,
            start_time_local=self.start_time_local,
            state=self.state,
            period=self.timing.current_period,
            display_clock=self.timing.display_clock,
            home=self.home.to_team_side(),
            away=self.away.to_team_side(),
            seconds_to_start=self.seconds_to_start,
            status_detail=self.status_detail,
        )
        # Attach sport metadata for downstream legacy consumers
        setattr(snapshot, "sport", self.sport)
        setattr(snapshot, "sport_type", self.sport)
        return snapshot
    
    def get_display_period(self) -> str:
        """Get appropriate period display for this sport."""
        return self.timing.period_name
    
    def is_overtime_game(self) -> bool:
        """Check if this game is in overtime."""
        return self.timing.is_overtime
    
    def get_sport_specific_status(self) -> List[str]:
        """Get sport-specific status indicators."""
        indicators = []
        
        if self.timing.is_overtime:
            if self.timing.is_shootout:
                indicators.append("SHOOTOUT")
            else:
                indicators.append("OVERTIME")
        
        if self.situation.power_play_active:
            pp_team = "HOME" if self.situation.power_play_team == "home" else "AWAY"
            indicators.append(f"PP {pp_team}")
        
        if self.sport == SportType.MLB and self.situation.inning_half:
            indicators.append(f"{self.situation.inning_half.upper()}")
            
        if self.sport == SportType.NFL and self.situation.down:
            indicators.append(f"{self.situation.down} & {self.situation.distance}")
        
        return indicators
    
    def get_score_differential(self) -> int:
        """Get absolute score difference."""
        return abs(self.home.score - self.away.score)
    
    def get_winning_team(self) -> Optional[SportTeam]:
        """Get currently winning team, or None if tied."""
        if self.home.score > self.away.score:
            return self.home
        elif self.away.score > self.home.score:
            return self.away
        return None


class SportGameState(Enum):
    """Enhanced game states that account for sport-specific situations."""
    SCHEDULED = "scheduled"       # Future game
    PREGAME = "pregame"          # Warm-ups, lineup announcements  
    LIVE = "live"                # Active gameplay
    INTERMISSION = "intermission" # Between periods/innings
    OVERTIME = "overtime"        # Overtime period
    SHOOTOUT = "shootout"        # NHL shootout
    FINAL = "final"              # Game completed
    POSTPONED = "postponed"      # Weather/other delay
    SUSPENDED = "suspended"      # Game halted mid-play


def convert_legacy_to_enhanced(
    legacy_snapshot,  # GameSnapshot
    sport: SportType
) -> EnhancedGameSnapshot:
    """Convert legacy GameSnapshot to EnhancedGameSnapshot."""
    from src.model.game import GameSnapshot
    
    if not isinstance(legacy_snapshot, GameSnapshot):
        raise ValueError(f"Expected GameSnapshot, got {type(legacy_snapshot)}")
    
    # Convert teams
    home_team = SportTeam(
        id=legacy_snapshot.home.id,
        name=legacy_snapshot.home.name,
        abbr=legacy_snapshot.home.abbr,
        score=legacy_snapshot.home.score,
        sport=sport
    )
    
    away_team = SportTeam(
        id=legacy_snapshot.away.id, 
        name=legacy_snapshot.away.name,
        abbr=legacy_snapshot.away.abbr,
        score=legacy_snapshot.away.score,
        sport=sport
    )
    
    # Create timing information
    timing = GameTiming(
        current_period=legacy_snapshot.period,
        period_name=_get_period_name_for_sport(sport, legacy_snapshot.period),
        period_max=_get_max_periods_for_sport(sport),
        display_clock=legacy_snapshot.display_clock,
        clock_running=legacy_snapshot.state == GameState.LIVE,
        is_overtime=legacy_snapshot.period > _get_max_periods_for_sport(sport)
    )
    
    return EnhancedGameSnapshot(
        sport=sport,
        event_id=legacy_snapshot.event_id,
        start_time_local=legacy_snapshot.start_time_local,
        state=legacy_snapshot.state,
        home=home_team,
        away=away_team,
        timing=timing,
        seconds_to_start=legacy_snapshot.seconds_to_start,
        status_detail=legacy_snapshot.status_detail,
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
            return f"{period}"
        else:
            return f"E{period - 9}"  # Extra inning
    elif sport == SportType.NFL:
        if period <= 4:
            return f"Q{period}"
        else:
            return "OT"
    
    return f"{period}"


def _get_max_periods_for_sport(sport: SportType) -> int:
    """Get maximum regulation periods for sport."""
    if sport in [SportType.WNBA, SportType.NBA, SportType.NFL]:
        return 4
    elif sport == SportType.NHL:
        return 3
    elif sport == SportType.MLB:
        return 9
    else:
        return 4  # Default fallback
