"""NBA league configuration and client."""

from datetime import date, datetime
from typing import List, Dict, Any, Optional
from dateutil.parser import parse as parse_datetime
import requests
import os

from ..models.league_config import LeagueConfig, LeagueAPIConfig, LeagueSeason
from ..clients.base import LeagueClient, LeagueGameSnapshot
from src.model.game import GameState, TeamSide


# NBA League Configuration (loaded from Supabase, this is a fallback)
NBA_LEAGUE = LeagueConfig(
    name="National Basketball Association",
    code="nba",
    sport_code="basketball",
    api=LeagueAPIConfig(
        base_url="http://site.api.espn.com/apis/site/v2/sports/basketball/nba",
        endpoints={
            "scoreboard": "/scoreboard",
            "teams": "/teams",
            "standings": "/standings",
        },
        rate_limit_per_minute=60,
        cache_ttl_seconds=300,
    ),
    team_count=30,
    conference_structure={
        "Eastern": ["Atlantic", "Central", "Southeast"],
        "Western": ["Northwest", "Pacific", "Southwest"],
    },
    # NBA uses 12-minute quarters (default for basketball)
    timing_overrides={
        "period_duration_minutes": 12,
    },
    current_season=LeagueSeason(
        start_date=date(2024, 10, 22),
        end_date=date(2025, 6, 20),
        playoff_start=date(2025, 4, 15),
        is_active=True,
    ),
)


class NBAClient(LeagueClient):
    """NBA-specific API client using ESPN."""

    def __init__(self, league_config, sport_config):
        """Initialize NBA client with league and sport configs."""
        super().__init__(league_config, sport_config)

    def fetch_games(self, target_date: date) -> List[LeagueGameSnapshot]:
        """Fetch NBA games for the target date."""
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
            print(f"[error] Failed to fetch NBA games: {e}")

        return games

    def _parse_game(self, event: dict) -> Optional[LeagueGameSnapshot]:
        """Parse a single NBA game from ESPN data."""
        try:
            event_id = event.get("id")
            if not event_id:
                return None

            # Parse game time
            game_date = event.get("date", "")
            start_time = parse_datetime(game_date) if game_date else datetime.now()

            # Parse game status
            status = event.get("status", {})
            status_type = status.get("type", {})
            state_code = status_type.get("name", "STATUS_SCHEDULED")

            # Map ESPN status to our GameState
            if state_code in ["STATUS_SCHEDULED", "STATUS_POSTPONED"]:
                game_state = GameState.PRE
            elif state_code in ["STATUS_FINAL", "STATUS_FINAL_OT"]:
                game_state = GameState.FINAL
            else:
                game_state = GameState.LIVE

            # Get period and clock
            period = status.get("period", 0)
            display_clock = status.get("displayClock", "")
            status_detail = status_type.get("detail", "")

            # Parse teams
            competitions = event.get("competitions", [])
            if not competitions:
                return None

            competition = competitions[0]
            competitors = competition.get("competitors", [])

            home_team = None
            away_team = None

            for comp in competitors:
                team_data = comp.get("team", {})
                is_home = comp.get("homeAway") == "home"

                team = TeamSide(
                    id=team_data.get("id"),
                    name=team_data.get("displayName", ""),
                    abbr=team_data.get("abbreviation", ""),
                    score=int(comp.get("score", 0))
                )

                if is_home:
                    home_team = team
                else:
                    away_team = team

            if not home_team or not away_team:
                return None

            # Format period name
            period_name = self._format_period_name(period, game_state)

            return LeagueGameSnapshot(
                sport=self.sport,
                league=self.league,
                event_id=event_id,
                start_time_local=start_time,
                state=game_state,
                home=home_team,
                away=away_team,
                current_period=period,
                period_name=period_name,
                display_clock=display_clock,
                seconds_to_start=-1 if game_state != GameState.PRE else int((start_time - datetime.now()).total_seconds()),
                status_detail=status_detail,
                sport_specific_data={
                    "is_playoff": "playoff" in status_detail.lower() if status_detail else False,
                    "is_overtime": period > 4,
                }
            )

        except Exception as e:
            print(f"[error] Failed to parse NBA game: {e}")
            return None

    def _format_period_name(self, period: int, state: GameState) -> str:
        """Format NBA period name."""
        if state == GameState.PRE:
            return ""
        elif state == GameState.FINAL:
            if period > 4:
                ot_num = period - 4
                return f"Final/OT{ot_num}" if ot_num > 1 else "Final/OT"
            return "Final"
        else:  # LIVE
            if period > 4:
                ot_num = period - 4
                return f"OT{ot_num}" if ot_num > 1 else "OT"
            return f"Q{period}"

    def fetch_teams(self) -> List[Dict[str, Any]]:
        """Fetch NBA team information."""
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
                    "id": team.get("id"),
                    "name": team.get("displayName"),
                    "abbreviation": team.get("abbreviation"),
                    "logo_url": team.get("logo"),
                    "colors": {
                        "primary": team.get("color"),
                        "secondary": team.get("alternateColor"),
                    }
                })

        except Exception as e:
            print(f"[error] Failed to fetch NBA teams: {e}")

        return teams