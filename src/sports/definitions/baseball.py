"""Baseball sport configuration."""

from ..models.sport_config import (
    SportConfig,
    TimingConfig,
    ScoringConfig,
    TerminologyConfig,
    PeriodType,
    ClockDirection,
)

BASEBALL_SPORT = SportConfig(
    name="Baseball",
    code="baseball",
    timing=TimingConfig(
        period_type=PeriodType.INNING,
        regulation_periods=9,
        period_duration_minutes=0,  # No time limit
        clock_direction=ClockDirection.NONE,
        has_overtime=True,  # Extra innings
        overtime_duration_minutes=0,  # No time limit
        has_shootout=False,
        has_sudden_death=False,
        intermission_duration_minutes=2.5,  # Between half-innings
        period_name_format="Inn {number}",
        overtime_name="Extra",
    ),
    scoring=ScoringConfig(
        scoring_types={
            "run": 1,
            "home_run": 1,  # Still scores 1 run per runner
            "grand_slam": 4,  # 4 runs total
        },
        default_score_value=1,
    ),
    terminology=TerminologyConfig(
        game_start_term="First Pitch",
        period_end_term="End of Inning",
        game_end_term="Final",
        overtime_term="Extra Innings",
    ),
    extensions={
        "has_top_bottom": True,  # Top/Bottom of inning
        "has_outs": True,
        "outs_per_half_inning": 3,
        "has_strikes": True,
        "strikes_for_out": 3,
        "has_balls": True,
        "balls_for_walk": 4,
        "has_bases": True,
        "number_of_bases": 3,
    },
)