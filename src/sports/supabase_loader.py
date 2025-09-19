"""Load sports and leagues configuration from Supabase."""

import os
from typing import List, Optional, Dict, Any
from supabase import create_client, Client
from dotenv import load_dotenv

from .models.sport_config import (
    SportConfig,
    TimingConfig,
    ScoringConfig,
    TerminologyConfig,
    PeriodType,
    ClockDirection,
)
from .models.league_config import (
    LeagueConfig,
    LeagueAPIConfig,
    LeagueSeason,
)
from .registry import registry

# Load environment variables
load_dotenv()


class SupabaseSportsLoader:
    """Load sports and leagues configuration from Supabase database."""

    def __init__(self):
        """Initialize Supabase client."""
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment")

        self.client: Client = create_client(supabase_url, supabase_key)

    def load_sports(self) -> List[SportConfig]:
        """Load all sports from database."""
        try:
            response = self.client.table("sports").select("*").execute()
        except Exception as e:
            error_msg = str(e)
            if "not found" in error_msg.lower() or "NOT_FOUND" in error_msg:
                raise ValueError(
                    "Sports table not found in database. "
                    "Please run the database migrations first. "
                    "See supabase/SETUP.md for instructions."
                )
            raise

        sports = []
        for sport_data in response.data:
            sport = self._parse_sport(sport_data)
            if sport:
                sports.append(sport)

        return sports

    def load_leagues(self) -> List[LeagueConfig]:
        """Load all leagues from database."""
        response = (
            self.client.table("leagues")
            .select("*, sport:sports(code)")
            .execute()
        )

        leagues = []
        for league_data in response.data:
            league = self._parse_league(league_data)
            if league:
                leagues.append(league)

        return leagues

    def _parse_sport(self, data: Dict[str, Any]) -> Optional[SportConfig]:
        """Parse sport data from database format."""
        try:
            timing_data = data.get("timing", {})
            scoring_data = data.get("scoring", {})
            terminology_data = data.get("terminology", {})

            # Parse timing configuration
            timing = TimingConfig(
                period_type=PeriodType(timing_data.get("periodType", "period")),
                regulation_periods=timing_data.get("regulationPeriods", 3),
                period_duration_minutes=timing_data.get("periodDurationMinutes", 20),
                clock_direction=ClockDirection(timing_data.get("clockDirection", "down")),
                has_overtime=timing_data.get("hasOvertime", False),
                overtime_duration_minutes=timing_data.get("overtimeDurationMinutes"),
                has_shootout=timing_data.get("hasShootout", False),
                has_sudden_death=timing_data.get("hasSuddenDeath", False),
                intermission_duration_minutes=timing_data.get("intermissionDurationMinutes", 15),
                period_name_format=timing_data.get("periodNameFormat", "{type}{number}"),
                overtime_name=timing_data.get("overtimeName", "OT"),
            )

            # Parse scoring configuration
            scoring = ScoringConfig(
                scoring_types=scoring_data.get("scoringTypes", {}),
                default_score_value=scoring_data.get("defaultScoreValue", 1),
            )

            # Parse terminology
            terminology = TerminologyConfig(
                game_start_term=terminology_data.get("gameStartTerm", "Start"),
                period_end_term=terminology_data.get("periodEndTerm", "End"),
                game_end_term=terminology_data.get("gameEndTerm", "Final"),
                overtime_term=terminology_data.get("overtimeTerm", "Overtime"),
            )

            return SportConfig(
                name=data.get("name", ""),
                code=data.get("code", ""),
                timing=timing,
                scoring=scoring,
                terminology=terminology,
                extensions=data.get("extensions", {}),
            )

        except Exception as e:
            print(f"Error parsing sport {data.get('code')}: {e}")
            return None

    def _parse_league(self, data: Dict[str, Any]) -> Optional[LeagueConfig]:
        """Parse league data from database format."""
        try:
            api_data = data.get("api_config", {})
            season_data = data.get("current_season")

            # Parse API configuration
            api = LeagueAPIConfig(
                base_url=api_data.get("baseUrl", ""),
                endpoints=api_data.get("endpoints", {}),
                rate_limit_per_minute=api_data.get("rateLimitPerMinute", 60),
                cache_ttl_seconds=api_data.get("cacheTTLSeconds", 300),
            )

            # Parse season if present
            season = None
            if season_data:
                # Handle both string (JSON) and dict formats
                if isinstance(season_data, str):
                    import json
                    season_data = json.loads(season_data)

                from datetime import date as date_cls
                season = LeagueSeason(
                    start_date=date_cls.fromisoformat(season_data.get("startDate")),
                    end_date=date_cls.fromisoformat(season_data.get("endDate")),
                    playoff_start=date_cls.fromisoformat(season_data.get("playoffStart"))
                    if season_data.get("playoffStart")
                    else None,
                    is_active=season_data.get("isActive", True),
                )

            # Get sport code from joined data
            sport_code = ""
            if data.get("sport") and isinstance(data["sport"], dict):
                sport_code = data["sport"].get("code", "")

            return LeagueConfig(
                name=data.get("name", ""),
                code=data.get("code", ""),
                sport_code=sport_code,
                api=api,
                current_season=season,
                timing_overrides=data.get("timing_overrides"),
                scoring_overrides=data.get("scoring_overrides"),
                terminology_overrides=data.get("terminology_overrides"),
                team_count=data.get("team_count", 0),
                conference_structure=data.get("conference_structure"),
                team_assets_url=data.get("team_assets_url"),
                logo_url_template=data.get("logo_url_template"),
            )

        except Exception as e:
            print(f"Error parsing league {data.get('code')}: {e}")
            return None

    def load_device_leagues(self, device_id: str) -> List[str]:
        """Load enabled league codes for a device."""
        response = (
            self.client.table("device_leagues")
            .select("league:leagues(code)")
            .eq("device_id", device_id)
            .eq("enabled", True)
            .order("priority")
            .execute()
        )

        return [
            item["league"]["code"]
            for item in response.data
            if item.get("league") and item["league"].get("code")
        ]

    def load_device_favorites(self, device_id: str, league_code: str) -> List[str]:
        """Load favorite team IDs for a device and league."""
        response = (
            self.client.table("device_favorite_teams")
            .select("team_id, league:leagues!inner(code)")
            .eq("device_id", device_id)
            .eq("league.code", league_code)
            .order("priority")
            .execute()
        )

        return [item["team_id"] for item in response.data]

    def initialize_registry(self) -> None:
        """Load all sports and leagues into the global registry."""
        # Load sports
        sports = self.load_sports()
        for sport in sports:
            registry.register_sport(sport)
            print(f"Registered sport: {sport.name}")

        # Load leagues
        leagues = self.load_leagues()
        for league in leagues:
            # For now, register without client class
            # In production, would map league code to appropriate client
            client_class = self._get_client_class(league.code)
            registry.register_league(league, client_class)
            print(f"Registered league: {league.name} ({league.sport_code})")

    def _get_client_class(self, league_code: str):
        """Get the appropriate client class for a league."""
        # Import here to avoid circular imports
        from .leagues.nhl import NHLClient
        from .leagues.wnba import WNBAClient
        from .leagues.nba import NBAClient

        client_map = {
            "nhl": NHLClient,
            "wnba": WNBAClient,
            "nba": NBAClient,
            # Add more as implemented
        }

        return client_map.get(league_code)


def initialize_from_supabase():
    """Initialize sports registry from Supabase database."""
    try:
        loader = SupabaseSportsLoader()
        loader.initialize_registry()
        return True
    except Exception as e:
        print(f"Failed to initialize from Supabase: {e}")
        # Fall back to hardcoded initialization
        from .initialize import initialize_sports_registry
        initialize_sports_registry()
        return False