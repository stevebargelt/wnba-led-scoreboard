"""Sport configuration models."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, Any


class PeriodType(Enum):
    """Types of game periods across different sports."""
    QUARTER = "quarter"
    PERIOD = "period"
    HALF = "half"
    INNING = "inning"
    SET = "set"


class ClockDirection(Enum):
    """Clock counting direction for different sports."""
    COUNT_DOWN = "down"  # Basketball, Hockey, Football
    COUNT_UP = "up"      # Soccer
    NONE = "none"        # Baseball


@dataclass
class TimingConfig:
    """Sport-level timing configuration."""
    period_type: PeriodType
    regulation_periods: int
    period_duration_minutes: float  # Can be fractional for seconds
    clock_direction: ClockDirection
    has_overtime: bool
    overtime_duration_minutes: Optional[float] = None
    has_shootout: bool = False  # Hockey specific
    has_sudden_death: bool = False
    intermission_duration_minutes: float = 15.0

    # Display formatting
    period_name_format: str = "{type}{number}"  # e.g., "Q{number}", "P{number}"
    overtime_name: str = "OT"

    def format_period_name(self, period_number: int, is_overtime: bool = False, is_shootout: bool = False) -> str:
        """Format period name based on configuration."""
        if is_shootout:
            return "SO"
        elif is_overtime:
            if period_number > self.regulation_periods + 1:
                # Multiple overtimes
                ot_num = period_number - self.regulation_periods
                return f"{self.overtime_name}{ot_num}"
            else:
                return self.overtime_name
        elif period_number <= self.regulation_periods:
            # Regular period
            type_char = self.period_type.value[0].upper()  # Q for quarter, P for period, etc.
            return self.period_name_format.replace("{type}", type_char).replace("{number}", str(period_number))
        else:
            return f"Period {period_number}"


@dataclass
class ScoringConfig:
    """Sport-level scoring configuration."""
    scoring_types: Dict[str, int]  # e.g., {"goal": 1, "safety": 2, "touchdown": 6}
    default_score_value: int = 1

    def get_score_value(self, score_type: str) -> int:
        """Get point value for a score type."""
        return self.scoring_types.get(score_type, self.default_score_value)


@dataclass
class TerminologyConfig:
    """Sport-specific terminology."""
    game_start_term: str  # "Tip", "Drop", "Kickoff", "First Pitch"
    period_end_term: str  # "End of Quarter", "End of Period"
    game_end_term: str    # "Final", "Full Time"
    overtime_term: str    # "Overtime", "Extra Time"

    def get_start_term(self) -> str:
        """Get the term for game start."""
        # Shorten if too long for display
        if len(self.game_start_term) > 10:
            # Try to use just the key word
            words = self.game_start_term.split()
            if len(words) > 1:
                return words[-1]  # e.g., "Puck Drop" -> "Drop"
        return self.game_start_term


@dataclass
class SportConfig:
    """Complete sport configuration."""
    name: str
    code: str  # e.g., "hockey", "basketball"
    timing: TimingConfig
    scoring: ScoringConfig
    terminology: TerminologyConfig

    # Optional sport-specific extensions
    extensions: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """Validate configuration."""
        if self.timing.has_overtime and self.timing.overtime_duration_minutes is None:
            # Default overtime duration if not specified
            self.timing.overtime_duration_minutes = 5.0

    def get_period_name(self, period: int, is_overtime: bool = False, is_shootout: bool = False) -> str:
        """Get display name for a period."""
        return self.timing.format_period_name(period, is_overtime, is_shootout)