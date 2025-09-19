"""Soccer/Football sport configuration."""

from ..models.sport_config import (
    SportConfig,
    TimingConfig,
    ScoringConfig,
    TerminologyConfig,
    PeriodType,
    ClockDirection,
)

SOCCER_SPORT = SportConfig(
    name="Soccer",
    code="soccer",
    timing=TimingConfig(
        period_type=PeriodType.HALF,
        regulation_periods=2,
        period_duration_minutes=45,
        clock_direction=ClockDirection.COUNT_UP,
        has_overtime=True,
        overtime_duration_minutes=30,  # Two 15-minute periods
        has_shootout=True,  # Penalty kicks
        has_sudden_death=False,
        intermission_duration_minutes=15,
        period_name_format="Half {number}",
        overtime_name="Extra Time",
    ),
    scoring=ScoringConfig(
        scoring_types={
            "goal": 1,
            "penalty_kick": 1,
            "own_goal": 1,
        },
        default_score_value=1,
    ),
    terminology=TerminologyConfig(
        game_start_term="Kickoff",
        period_end_term="Half Time",
        game_end_term="Full Time",
        overtime_term="Extra Time",
    ),
    extensions={
        "has_offside": True,
        "has_stoppage_time": True,
        "has_yellow_cards": True,
        "has_red_cards": True,
        "max_substitutions": 3,
    },
)