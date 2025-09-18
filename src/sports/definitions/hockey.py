"""Hockey sport configuration."""

from ..models.sport_config import (
    SportConfig,
    TimingConfig,
    ScoringConfig,
    TerminologyConfig,
    PeriodType,
    ClockDirection,
)

HOCKEY_SPORT = SportConfig(
    name="Hockey",
    code="hockey",
    timing=TimingConfig(
        period_type=PeriodType.PERIOD,
        regulation_periods=3,
        period_duration_minutes=20,
        clock_direction=ClockDirection.COUNT_DOWN,
        has_overtime=True,
        overtime_duration_minutes=5,
        has_shootout=True,
        has_sudden_death=True,
        intermission_duration_minutes=18,
        period_name_format="P{number}",
        overtime_name="OT",
    ),
    scoring=ScoringConfig(
        scoring_types={
            "goal": 1,
            "empty_net": 1,
            "penalty_shot": 1,
            "shootout_goal": 1,
        },
        default_score_value=1,
    ),
    terminology=TerminologyConfig(
        game_start_term="Puck Drop",
        period_end_term="End of Period",
        game_end_term="Final",
        overtime_term="Overtime",
    ),
    extensions={
        "has_penalty_box": True,
        "has_power_play": True,
        "max_players_on_ice": 6,
        "goalie_pulled_situations": True,
    },
)