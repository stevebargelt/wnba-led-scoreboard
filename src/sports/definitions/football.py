"""American Football sport configuration."""

from ..models.sport_config import (
    SportConfig,
    TimingConfig,
    ScoringConfig,
    TerminologyConfig,
    PeriodType,
    ClockDirection,
)

FOOTBALL_SPORT = SportConfig(
    name="Football",
    code="football",
    timing=TimingConfig(
        period_type=PeriodType.QUARTER,
        regulation_periods=4,
        period_duration_minutes=15,
        clock_direction=ClockDirection.COUNT_DOWN,
        has_overtime=True,
        overtime_duration_minutes=10,  # NFL regular season
        has_shootout=False,
        has_sudden_death=True,  # In overtime
        intermission_duration_minutes=12,  # Halftime is longer
        period_name_format="Q{number}",
        overtime_name="OT",
    ),
    scoring=ScoringConfig(
        scoring_types={
            "touchdown": 6,
            "field_goal": 3,
            "safety": 2,
            "extra_point": 1,
            "two_point_conversion": 2,
        },
        default_score_value=6,
    ),
    terminology=TerminologyConfig(
        game_start_term="Kickoff",
        period_end_term="End of Quarter",
        game_end_term="Final",
        overtime_term="Overtime",
    ),
    extensions={
        "has_downs": True,
        "downs_to_first": 4,
        "yards_to_first": 10,
        "has_play_clock": True,
        "play_clock_seconds": 40,
        "has_two_minute_warning": True,
    },
)