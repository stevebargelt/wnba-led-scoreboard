"""NHL league configuration and client."""

from datetime import date, datetime
from typing import List, Dict, Any, Optional
from dateutil.parser import parse as parse_datetime
import requests
import os

from ..models.league_config import LeagueConfig, LeagueAPIConfig, LeagueSeason
from ..clients.base import LeagueClient, LeagueGameSnapshot
from src.model.game import GameState, TeamSide


# NHL League Configuration
NHL_LEAGUE = LeagueConfig(
    name="National Hockey League",
    code="nhl",
    sport_code="hockey",
    api=LeagueAPIConfig(
        base_url="https://api-web.nhle.com/v1",
        endpoints={
            "scoreboard": "/score/{date}",
            "schedule": "/schedule/{date}",
            "teams": "/teams",
            "standings": "/standings",
        },
        rate_limit_per_minute=60,
        cache_ttl_seconds=300,
    ),
    team_count=32,
    conference_structure={
        "Eastern": ["Metropolitan", "Atlantic"],
        "Western": ["Central", "Pacific"],
    },
    # NHL specific timing overrides
    timing_overrides={
        "overtime_duration_minutes": 5,  # 3-on-3 OT in regular season
        "has_shootout": True,  # After OT in regular season
    },
    team_assets_url="https://api-web.nhle.com/v1/teams",
    logo_url_template="https://assets.nhle.com/logos/nhl/svg/{abbr}_light.svg",
    current_season=LeagueSeason(
        start_date=date(2024, 10, 4),
        end_date=date(2025, 6, 30),
        playoff_start=date(2025, 4, 15),
        is_active=True,
    ),
)


class NHLClient(LeagueClient):
    """NHL-specific API client."""

    def __init__(self, sport_config):
        """Initialize NHL client with sport config."""
        super().__init__(NHL_LEAGUE, sport_config)

    def fetch_games(self, target_date: date) -> List[LeagueGameSnapshot]:
        """Fetch NHL games for the target date."""
        games = []
        datestr = target_date.strftime("%Y-%m-%d")
        url = f"{self.league.api.base_url}/score/{datestr}"

        try:
            timeout = float(os.getenv("HTTP_TIMEOUT", "10"))
            response = requests.get(url, timeout=timeout)
            response.raise_for_status()
            data = response.json()

            # Current day's games
            if "games" in data:
                for game in data["games"]:
                    game_snapshot = self._parse_game(game, target_date)
                    if game_snapshot:
                        games.append(game_snapshot)

            # Previous day's games (if any still ongoing)
            if "prevDate" in data and isinstance(data.get("gamesByDate"), list):
                for date_games in data["gamesByDate"]:
                    if date_games.get("date") == data["prevDate"]:
                        for game in date_games.get("games", []):
                            game_snapshot = self._parse_game(game, target_date)
                            if game_snapshot:
                                games.append(game_snapshot)

        except Exception as e:
            print(f"[error] Failed to fetch NHL games: {e}")

        return games

    def _parse_game(self, game: dict, target_date: date) -> Optional[LeagueGameSnapshot]:
        """Parse a single NHL game."""
        try:
            game_id = game.get("id")
            if not game_id:
                return None

            # Get teams
            home_team = game.get("homeTeam", {})
            away_team = game.get("awayTeam", {})

            home = TeamSide(
                id=str(home_team.get("id", "")),
                name=home_team.get("name", {}).get("default", ""),
                abbr=home_team.get("abbrev", ""),
                score=int(home_team.get("score", 0)),
            )

            away = TeamSide(
                id=str(away_team.get("id", "")),
                name=away_team.get("name", {}).get("default", ""),
                abbr=away_team.get("abbrev", ""),
                score=int(away_team.get("score", 0)),
            )

            # Parse game state
            game_state_str = game.get("gameState", "")
            state = self.parse_game_state(game_state_str)

            # Parse time information
            start_time_str = game.get("startTimeUTC", "")
            start_time_utc = parse_datetime(start_time_str) if start_time_str else datetime.now()

            # Parse period and clock
            period_descriptor = game.get("periodDescriptor", {})
            current_period = int(period_descriptor.get("number", 0))
            period_type = period_descriptor.get("periodType", "")

            # Determine if overtime or shootout
            is_overtime = period_type == "OT"
            is_shootout = period_type == "SO"

            # Get period name using sport configuration
            period_name = self.format_period_name(current_period, is_overtime, is_shootout)

            # Get clock
            clock = game.get("clock", {})
            time_remaining = clock.get("timeRemaining", "")
            display_clock = time_remaining if time_remaining else "00:00"

            # Calculate seconds to start for pregame
            seconds_to_start = -1
            if state == GameState.PRE:
                now_utc = datetime.now(start_time_utc.tzinfo)
                delta = start_time_utc - now_utc
                seconds_to_start = max(0, int(delta.total_seconds()))

            # Get status detail
            game_schedule_state = game.get("gameScheduleState", "")
            if game_schedule_state:
                status_detail = game_schedule_state
            else:
                status_detail = period_name

            return LeagueGameSnapshot(
                sport=self.sport,
                league=self.league,
                event_id=str(game_id),
                start_time_local=start_time_utc,
                state=state,
                home=home,
                away=away,
                current_period=current_period,
                period_name=period_name,
                display_clock=display_clock,
                seconds_to_start=seconds_to_start,
                status_detail=status_detail,
                sport_specific_data={
                    "is_overtime": is_overtime,
                    "is_shootout": is_shootout,
                    "period_type": period_type,
                },
            )

        except Exception as e:
            print(f"[warn] Failed to parse NHL game: {e}")
            return None

    def fetch_teams(self) -> List[Dict[str, Any]]:
        """Fetch NHL team information."""
        teams = []
        url = f"{self.league.api.base_url}/teams"

        try:
            timeout = float(os.getenv("HTTP_TIMEOUT", "10"))
            response = requests.get(url, timeout=timeout)
            response.raise_for_status()
            data = response.json()

            for team in data.get("teams", []):
                teams.append({
                    "id": str(team.get("id", "")),
                    "name": team.get("fullName", ""),
                    "abbreviation": team.get("triCode", ""),
                    "logo_url": self.league.logo_url_template.format(
                        abbr=team.get("triCode", "").upper()
                    ) if self.league.logo_url_template else None,
                    "conference": team.get("conference", {}).get("name", ""),
                    "division": team.get("division", {}).get("name", ""),
                })

        except Exception as e:
            print(f"[error] Failed to fetch NHL teams: {e}")

        return teams