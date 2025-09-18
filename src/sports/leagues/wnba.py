"""WNBA league configuration and client."""

from datetime import date, datetime
from typing import List, Dict, Any, Optional
from dateutil.parser import parse as parse_datetime
import requests
import os

from ..models.league_config import LeagueConfig, LeagueAPIConfig, LeagueSeason
from ..clients.base import LeagueClient, LeagueGameSnapshot
from src.model.game import GameState, TeamSide


# WNBA League Configuration
WNBA_LEAGUE = LeagueConfig(
    name="Women's National Basketball Association",
    code="wnba",
    sport_code="basketball",
    api=LeagueAPIConfig(
        base_url="http://site.api.espn.com/apis/site/v2/sports/basketball/wnba",
        endpoints={
            "scoreboard": "/scoreboard",
            "teams": "/teams",
            "standings": "/standings",
        },
        rate_limit_per_minute=60,
        cache_ttl_seconds=300,
    ),
    team_count=12,
    conference_structure={
        "Eastern": [],  # No divisions in WNBA
        "Western": [],
    },
    # WNBA specific timing overrides
    timing_overrides={
        "period_duration_minutes": 10,  # 10-minute quarters vs NBA's 12
    },
    current_season=LeagueSeason(
        start_date=date(2025, 5, 16),
        end_date=date(2025, 10, 20),
        playoff_start=date(2025, 9, 15),
        is_active=False,  # Off-season currently
    ),
)


class WNBAClient(LeagueClient):
    """WNBA-specific API client using ESPN."""

    def __init__(self, sport_config):
        """Initialize WNBA client with sport config."""
        super().__init__(WNBA_LEAGUE, sport_config)

    def fetch_games(self, target_date: date) -> List[LeagueGameSnapshot]:
        """Fetch WNBA games for the target date."""
        games = []
        datestr = target_date.strftime("%Y%m%d")
        url = f"{self.league.api.base_url}/scoreboard"
        params = {"dates": datestr}

        try:
            timeout = float(os.getenv("HTTP_TIMEOUT", "10"))
            response = requests.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            data = response.json()

            for event in data.get("events", []):
                game_snapshot = self._parse_game(event)
                if game_snapshot:
                    games.append(game_snapshot)

        except Exception as e:
            print(f"[error] Failed to fetch WNBA games: {e}")

        return games

    def _parse_game(self, event: dict) -> Optional[LeagueGameSnapshot]:
        """Parse a single WNBA game from ESPN data."""
        try:
            event_id = event.get("id")
            if not event_id:
                return None

            # Get competition data
            competition = (event.get("competitions") or [{}])[0]
            competitors = competition.get("competitors", [])

            # Find home and away teams
            home_raw = next((c for c in competitors if c.get("homeAway") == "home"), None)
            away_raw = next((c for c in competitors if c.get("homeAway") == "away"), None)

            if not home_raw or not away_raw:
                return None

            # Parse teams
            def parse_team(competitor: dict) -> TeamSide:
                team = competitor.get("team", {})
                return TeamSide(
                    id=str(team.get("id")) if team.get("id") is not None else None,
                    name=team.get("displayName") or team.get("name") or "",
                    abbr=team.get("abbreviation") or (team.get("shortDisplayName") or "").upper(),
                    score=int(competitor.get("score") or 0),
                )

            home = parse_team(home_raw)
            away = parse_team(away_raw)

            # Parse game state
            status = competition.get("status", {}).get("type", {})
            state_str = (status.get("state") or "").lower()
            state = self.parse_game_state(state_str)

            # Parse time information
            start_time_iso = event.get("date")
            start_time_utc = parse_datetime(start_time_iso) if start_time_iso else datetime.now()

            # Parse period and clock
            period = int(competition.get("status", {}).get("period") or 0)
            display_clock = competition.get("status", {}).get("displayClock") or ""

            # Determine if overtime
            is_overtime = period > self.effective_timing.regulation_periods

            # Get period name using sport configuration
            period_name = self.format_period_name(period, is_overtime)

            # Calculate seconds to start for pregame
            seconds_to_start = -1
            if state == GameState.PRE:
                now_utc = datetime.now(start_time_utc.tzinfo)
                delta = start_time_utc - now_utc
                seconds_to_start = max(0, int(delta.total_seconds()))

            # Get status detail
            status_detail = status.get("detail") or ""
            if not status_detail:
                status_detail = period_name

            return LeagueGameSnapshot(
                sport=self.sport,
                league=self.league,
                event_id=str(event_id),
                start_time_local=start_time_utc,
                state=state,
                home=home,
                away=away,
                current_period=period,
                period_name=period_name,
                display_clock=display_clock,
                seconds_to_start=seconds_to_start,
                status_detail=status_detail,
                sport_specific_data={
                    "is_overtime": is_overtime,
                    "broadcast": event.get("broadcasts", []),
                },
            )

        except Exception as e:
            print(f"[warn] Failed to parse WNBA game: {e}")
            return None

    def fetch_teams(self) -> List[Dict[str, Any]]:
        """Fetch WNBA team information from ESPN."""
        teams = []
        url = f"{self.league.api.base_url}/teams"

        try:
            timeout = float(os.getenv("HTTP_TIMEOUT", "10"))
            response = requests.get(url, timeout=timeout)
            response.raise_for_status()
            data = response.json()

            for team_data in data.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", []):
                team = team_data.get("team", {})
                teams.append({
                    "id": str(team.get("id", "")),
                    "name": team.get("displayName", ""),
                    "abbreviation": team.get("abbreviation", ""),
                    "logo_url": team.get("logos", [{}])[0].get("href") if team.get("logos") else None,
                    "colors": {
                        "primary": team.get("color", ""),
                        "alternate": team.get("alternateColor", ""),
                    },
                    "venue": team.get("venue", {}).get("fullName", ""),
                })

        except Exception as e:
            print(f"[error] Failed to fetch WNBA teams: {e}")

        return teams