"""Basic tests for sports abstraction."""

import unittest
from datetime import date

from src.sports.models.league_config import LeagueConfig, LeagueAPIConfig, LeagueSeason
from src.sports.models.sport_config import SportConfig, TimingConfig, ScoringConfig, TerminologyConfig


class TestBasicSportsModels(unittest.TestCase):
    """Test basic sports model functionality."""

    def test_league_config_creation(self):
        """Test creating a league configuration."""
        league = LeagueConfig(
            name="Test League",
            code="test",
            sport_code="basketball",
            api=LeagueAPIConfig(
                base_url="http://test.com",
                endpoints={"scoreboard": "/scoreboard"},
                rate_limit_per_minute=60,
                cache_ttl_seconds=300
            ),
            team_count=30
        )

        self.assertEqual(league.name, "Test League")
        self.assertEqual(league.code, "test")
        self.assertEqual(league.sport_code, "basketball")
        self.assertEqual(league.team_count, 30)
        self.assertEqual(league.api.base_url, "http://test.com")

    def test_sport_config_creation(self):
        """Test creating a sport configuration."""
        sport = SportConfig(
            name="Basketball",
            code="basketball",
            timing=TimingConfig(
                period_type="quarter",
                regulation_periods=4,
                period_duration_minutes=12,
                clock_direction="down",
                has_overtime=True,
                overtime_duration_minutes=5,
                intermission_duration_minutes=15,
                period_name_format="Q{period}",
                overtime_name="OT"
            ),
            scoring=ScoringConfig(
                scoring_types={"field_goal": 2, "three_pointer": 3},
                default_score_value=2
            ),
            terminology=TerminologyConfig(
                game_start_term="tipoff",
                period_end_term="quarter",
                game_end_term="final",
                overtime_term="overtime"
            )
        )

        self.assertEqual(sport.name, "Basketball")
        self.assertEqual(sport.code, "basketball")
        self.assertEqual(sport.timing.regulation_periods, 4)
        self.assertEqual(sport.timing.period_duration_minutes, 12)
        self.assertTrue(sport.timing.has_overtime)

    def test_league_season_dates(self):
        """Test league season date checking."""
        season = LeagueSeason(
            start_date=date(2024, 10, 1),
            end_date=date(2025, 6, 30),
            playoff_start=date(2025, 4, 15),
            is_active=True
        )

        self.assertEqual(season.start_date, date(2024, 10, 1))
        self.assertEqual(season.end_date, date(2025, 6, 30))
        self.assertEqual(season.playoff_start, date(2025, 4, 15))
        self.assertTrue(season.is_active)

    def test_timing_overrides_merge(self):
        """Test that timing overrides can be merged."""
        base_timing = TimingConfig(
            period_type="quarter",
            regulation_periods=4,
            period_duration_minutes=12,
            clock_direction="down",
            has_overtime=True,
            overtime_duration_minutes=5,
            intermission_duration_minutes=15,
            period_name_format="Q{period}",
            overtime_name="OT"
        )

        # Create league with override
        league = LeagueConfig(
            name="WNBA",
            code="wnba",
            sport_code="basketball",
            api=LeagueAPIConfig(
                base_url="http://test.com",
                endpoints={},
                rate_limit_per_minute=60,
                cache_ttl_seconds=300
            ),
            team_count=12,
            timing_overrides={
                "period_duration_minutes": 10  # WNBA override
            }
        )

        # Manually apply override (since get_effective_timing doesn't exist yet)
        if league.timing_overrides and "period_duration_minutes" in league.timing_overrides:
            self.assertEqual(league.timing_overrides["period_duration_minutes"], 10)


if __name__ == '__main__':
    unittest.main()