"""Basketball sport configuration."""

from ..models.sport_config import (
    SportConfig,
    TimingConfig,
    ScoringConfig,
    TerminologyConfig,
    PeriodType,
    ClockDirection,
)

BASKETBALL_SPORT = SportConfig(
    name="Basketball",
    code="basketball",
    timing=TimingConfig(
        period_type=PeriodType.QUARTER,
        regulation_periods=4,
        period_duration_minutes=12,  # Default NBA/WNBA, can be overridden
        clock_direction=ClockDirection.COUNT_DOWN,
        has_overtime=True,
        overtime_duration_minutes=5,
        has_shootout=False,
        has_sudden_death=False,
        intermission_duration_minutes=15,
        period_name_format="Q{number}",
        overtime_name="OT",
    ),
    scoring=ScoringConfig(
        scoring_types={
            "free_throw": 1,
            "field_goal": 2,
            "three_pointer": 3,
            "two_pointer": 2,
            "dunk": 2,
            "layup": 2,
        },
        default_score_value=2,
    ),
    terminology=TerminologyConfig(
        game_start_term="Tip Off",
        period_end_term="End of Quarter",
        game_end_term="Final",
        overtime_term="Overtime",
    ),
    extensions={
        "has_shot_clock": True,
        "shot_clock_seconds": 24,
        "has_three_point_line": True,
        "has_free_throws": True,
        "max_fouls_before_ejection": 6,
        "team_fouls_for_bonus": 5,
    },
)