"""
NHL API client implementation with resilience features.
"""

import os
import json
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any

from src.data.resilient_client import ResilientHTTPClient
from src.model.sport_game import EnhancedGameSnapshot, SportTeam, GameTiming, SportSituation
from src.model.game import GameState
from src.sports.base import SportClient, SportClientInfo, SportType


class NHLClient(SportClient):
    """NHL API client with resilience, caching, and NHL-specific parsing."""
    
    def __init__(self, cache_dir: str = "cache/nhl"):
        # Get NHL-specific configuration from environment
        self.base_timeout = float(os.getenv("NHL_HTTP_TIMEOUT", "10"))
        self.cache_ttl = int(os.getenv("NHL_CACHE_TTL", "300"))  # 5 minutes
        self.stale_cache_max_age = int(os.getenv("NHL_STALE_CACHE_MAX_AGE", "3600"))  # 1 hour
        self.circuit_failure_threshold = int(os.getenv("NHL_CIRCUIT_FAILURE_THRESHOLD", "3"))
        
        # Initialize resilient HTTP client
        self.client = ResilientHTTPClient(
            base_url="https://api-web.nhle.com/v1",
            cache_dir=cache_dir,
            circuit_failure_threshold=self.circuit_failure_threshold,
            circuit_recovery_timeout=60,
            cache_ttl=self.cache_ttl,
            max_retries=3,
            backoff_factor=1.5,
            timeout=self.base_timeout,
        )
        
        # Track last successful data for emergency fallback
        self._last_known_games: List[EnhancedGameSnapshot] = []
        self._last_successful_fetch: Optional[datetime] = None
        self.used_static_fallback: bool = False
    
    def get_sport_info(self) -> SportClientInfo:
        """Get NHL client information."""
        return SportClientInfo(
            sport_type=SportType.NHL,
            name="NHL Official API",
            api_base_url="https://api-web.nhle.com/v1",
            default_cache_ttl=self.cache_ttl,
            supports_live_updates=True,
            supports_schedules=True,
            rate_limit_per_minute=60,  # Conservative estimate
        )
    
    def fetch_games(self, target_date: date) -> List[EnhancedGameSnapshot]:
        """
        Fetch NHL games for the target date.
        
        Args:
            target_date: Date to fetch games for
            
        Returns:
            List of EnhancedGameSnapshot objects for NHL games
        """
        # Format date for NHL API (YYYY-MM-DD)
        date_str = target_date.strftime("%Y-%m-%d")
        
        # Determine cache TTL based on how recent the date is
        cache_ttl = self._get_adaptive_cache_ttl(target_date)
        
        params = {"site": os.getenv("NHL_SCOREBOARD_SITE", "en_nhl")}

        data = self.client.get(
            endpoint=f"scoreboard/{date_str}",
            params=params,
            cache_ttl=cache_ttl,
            use_cache=True,
            fallback_to_stale=True,
        )

        # Backward compatibility with older endpoint if the new one fails
        if not isinstance(data, dict) or "games" not in data:
            data = self.client.get(
                endpoint=f"score/{date_str}",
                cache_ttl=cache_ttl,
                use_cache=True,
                fallback_to_stale=True,
            )
        
        if data is None:
            # Emergency fallback: return last known data if recent enough
            return self._get_emergency_fallback(target_date)
        
        # Parse the NHL response
        try:
            games = self._parse_nhl_response(data, target_date)
            
            # Update emergency fallback data
            if games:
                self._last_known_games = games
                self._last_successful_fetch = datetime.now()
            
            return games
            
        except Exception as e:
            print(f"[error] Failed to parse NHL response: {e}")
            return self._get_emergency_fallback(target_date)
    
    def fetch_team_info(self) -> List[Dict[str, Any]]:
        """
        Fetch NHL team information.

        Returns:
            List of team dictionaries with NHL team data
        """
        self.used_static_fallback = False

        teams: List[Dict[str, Any]] = []

        primary_sources = [
            ("teams", None),
            ("teams/summary", None),
            ("https://api.nhle.com/stats/rest/en/team", None),
        ]

        for endpoint, params in primary_sources:
            data = self.client.get(
                endpoint=endpoint,
                params=params,
                cache_ttl=86400,
                use_cache=True,
                fallback_to_stale=True,
            )

            if not data:
                continue

            records: List[Dict[str, Any]] = []
            if isinstance(data, dict):
                if "teams" in data and isinstance(data["teams"], list):
                    records = data["teams"]
                elif "data" in data and isinstance(data["data"], list):
                    records = data["data"]
            elif isinstance(data, list):
                records = data

            for row in records:
                team_id = row.get("id") or row.get("teamId") or row.get("teamID") or row.get("franchiseId")
                abbr = row.get("abbrev") or row.get("triCode") or row.get("teamAbbrev") or row.get("abbreviation")
                if not team_id and abbr:
                    team_id = abbr
                if not abbr and team_id:
                    abbr = str(team_id)

                name = None
                if isinstance(row.get("name"), dict):
                    name = row["name"].get("default")
                elif isinstance(row.get("teamName"), dict):
                    name = row["teamName"].get("default")
                elif isinstance(row.get("teamName"), str):
                    name = row["teamName"]
                elif isinstance(row.get("fullName"), str):
                    name = row["fullName"]
                elif isinstance(row.get("name"), str):
                    name = row["name"]

                display = None
                place = row.get("placeName") or {}
                if isinstance(place, dict):
                    place_default = place.get("default")
                else:
                    place_default = None
                if place_default and name and place_default not in name:
                    display = f"{place_default} {name}".strip()
                else:
                    display = name or place_default or ""

                conference = ""
                division = ""
                conf = row.get("conference")
                if isinstance(conf, dict):
                    conference = conf.get("name") or conf.get("nameShort") or ""
                elif isinstance(row.get("conferenceName"), str):
                    conference = row.get("conferenceName")

                div = row.get("division")
                if isinstance(div, dict):
                    division = div.get("name") or div.get("nameShort") or ""
                elif isinstance(row.get("divisionName"), str):
                    division = row.get("divisionName")

                if team_id and abbr:
                    team_info = {
                        "id": str(team_id),
                        "name": name or display or str(abbr),
                        "displayName": display or name or str(abbr),
                        "abbreviation": str(abbr).upper(),
                        "conference": conference,
                        "division": division,
                    }
                    teams.append(team_info)

            if teams:
                break

        if teams:
            dedup: Dict[str, Dict[str, Any]] = {}
            for team in teams:
                key = team["abbreviation"].upper()
                dedup[key] = team
            return list(dedup.values())

        # Offline fallback: use fetched teams from assets
        nhl_teams_file = Path(__file__).parent.parent.parent / "assets" / "nhl_teams.json"
        if nhl_teams_file.exists():
            try:
                with open(nhl_teams_file, "r") as f:
                    teams_data = json.load(f)
                    self.used_static_fallback = True
                    print("[info] Using cached NHL team list from assets/nhl_teams.json")
                    return teams_data
            except (json.JSONDecodeError, IOError) as e:
                print(f"[warn] Failed to load NHL teams from {nhl_teams_file}: {e}")

        print("[warn] No NHL team data available (run scripts/fetch_nhl_assets.py to populate)")
        self.used_static_fallback = True
        return []
    
    def _parse_nhl_response(self, data: Dict[str, Any], target_date: date) -> List[EnhancedGameSnapshot]:
        """Parse NHL API response into EnhancedGameSnapshot objects."""
        games = []
        
        # NHL API structure: {"games": [...]}
        for game_data in data.get("games", []):
            try:
                game = self._parse_single_nhl_game(game_data)
                if game:
                    games.append(game)
            except Exception as e:
                game_id = game_data.get("id", "unknown")
                print(f"[warn] Failed to parse NHL game {game_id}: {e}")
                continue
        
        return games
    
    def _parse_single_nhl_game(self, game_data: Dict[str, Any]) -> Optional[EnhancedGameSnapshot]:
        """Parse a single NHL game from API data."""
        game_id = game_data.get("id")
        if not game_id:
            return None
        
        # Parse team information
        home_team = self._parse_nhl_team(game_data.get("homeTeam", {}) or game_data.get("home", {}), "home")
        away_team = self._parse_nhl_team(game_data.get("awayTeam", {}) or game_data.get("away", {}), "away") 
        
        if not home_team or not away_team:
            return None
        
        # Parse game state
        game_state = self._parse_nhl_game_state(game_data)
        
        # Parse timing information
        timing = self._parse_nhl_timing(game_data)
        
        # Parse start time
        start_time_str = (
            game_data.get("startTimeUTC")
            or game_data.get("gameDate")
            or game_data.get("startTime")
        )
        if not start_time_str:
            return None
        
        try:
            start_time_utc = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))
        except ValueError:
            return None
        
        # Parse sport-specific situation
        situation = self._parse_nhl_situation(game_data)
        
        # Calculate seconds to start for pregame
        seconds_to_start = -1
        if game_state == GameState.PRE:
            now_utc = datetime.now(start_time_utc.tzinfo)
            delta = start_time_utc - now_utc
            seconds_to_start = max(0, int(delta.total_seconds()))
        
        status_detail = (
            game_data.get("gameStatusText")
            or (game_data.get("gameStatus") or {}).get("detailedState")
            or (game_data.get("gameStatus") or {}).get("description")
            or game_data.get("gameState", "")
        )

        venue = ""
        venue_info = game_data.get("venue") or {}
        if isinstance(venue_info, dict):
            venue = venue_info.get("default") or venue_info.get("name") or ""
        if not venue:
            venue = game_data.get("venueName", "")

        return EnhancedGameSnapshot(
            sport=SportType.NHL,
            event_id=str(game_id),
            start_time_local=start_time_utc,
            state=game_state,
            home=home_team,
            away=away_team,
            timing=timing,
            situation=situation,
            seconds_to_start=seconds_to_start,
            status_detail=status_detail,
            venue=venue,
            raw_api_data=game_data,
        )
    
    def _parse_nhl_team(self, team_data: Dict[str, Any], home_away: str) -> Optional[SportTeam]:
        """Parse NHL team data."""
        if not team_data:
            return None
        
        team_id = (
            team_data.get("id")
            or team_data.get("teamId")
            or team_data.get("teamID")
            or team_data.get("clubId")
        )
        if team_id is None:
            return None

        # Get team colors (if available)
        colors = {}
        if "primaryColor" in team_data:
            colors["primary"] = team_data["primaryColor"]
        if "secondaryColor" in team_data:
            colors["secondary"] = team_data["secondaryColor"]

        name = None
        if isinstance(team_data.get("name"), dict):
            name = team_data["name"].get("default")
        elif isinstance(team_data.get("teamName"), dict):
            name = team_data["teamName"].get("default")
        elif isinstance(team_data.get("teamName"), str):
            name = team_data["teamName"]
        elif isinstance(team_data.get("name"), str):
            name = team_data.get("name")
        elif isinstance(team_data.get("placeName"), dict):
            place = team_data.get("placeName", {}).get("default")
            nickname = team_data.get("clubName", {}).get("default") if isinstance(team_data.get("clubName"), dict) else None
            if place and nickname:
                name = f"{place} {nickname}".strip()
            elif place:
                name = place

        if not name:
            name = team_data.get("shortName") or team_data.get("market") or "Unknown Team"

        abbr = (
            team_data.get("abbrev")
            or team_data.get("triCode")
            or team_data.get("teamAbbrev")
            or team_data.get("teamCode")
            or "UNK"
        )

        logo = (
            team_data.get("logo")
            or team_data.get("lightLogo")
            or team_data.get("darkLogo")
        )

        return SportTeam(
            id=str(team_id),
            name=name,
            abbr=abbr,
            score=int(team_data.get("score", 0)),
            sport=SportType.NHL,
            colors=colors,
            logo_url=logo or "",
        )
    
    def _parse_nhl_game_state(self, game_data: Dict[str, Any]) -> GameState:
        """Parse NHL game state."""
        game_state = game_data.get("gameState", "").upper()
        
        # NHL game states: "FUT", "PRE", "LIVE", "FINAL", "OFF"
        if game_state in ["FUT", "PRE"]:
            return GameState.PRE
        elif game_state == "LIVE":
            return GameState.LIVE
        elif game_state in ["FINAL", "OFF"]:
            return GameState.FINAL
        else:
            # Default to LIVE for unknown states during game time
            return GameState.LIVE
    
    def _parse_nhl_timing(self, game_data: Dict[str, Any]) -> GameTiming:
        """Parse NHL timing information."""
        period_info = game_data.get("periodDescriptor") or {}
        period = int(period_info.get("number") or game_data.get("period", 1) or 0)
        clock_info = game_data.get("clock", {}) or {}
        clock = (
            clock_info.get("timeRemaining")
            or clock_info.get("displayValue")
            or clock_info.get("defaultValue")
            or "20:00"
        )

        # Determine if overtime/shootout
        period_type = (period_info.get("periodType") or "").upper()
        is_overtime = period > 3 or period_type in {"OT", "OVERTIME", "SO"}
        is_shootout = (
            game_data.get("gameState") == "SO"
            or period_type == "SO"
            or "shootout" in str(game_data.get("gameStatusText", "")).lower()
        )

        # NHL period naming
        period_name = (
            period_info.get("periodOrdinal")
            or ("SO" if is_shootout else "OT" if is_overtime and period > 3 else None)
        )
        if not period_name:
            period_name = f"P{period if period else 1}"

        return GameTiming(
            current_period=period,
            period_name=period_name,
            period_max=3,  # NHL regulation periods
            display_clock=clock,
            clock_running=bool(
                clock_info.get("running")
                or clock_info.get("clockRunning")
            ),
            is_intermission=(
                game_data.get("gameState") == "INT"
                or bool(clock_info.get("inIntermission"))
            ),
            is_overtime=is_overtime,
            is_shootout=is_shootout,
        )
    
    def _parse_nhl_situation(self, game_data: Dict[str, Any]) -> SportSituation:
        """Parse NHL-specific game situation (power plays, etc.)."""
        situation = SportSituation()
        
        # Check for power play situation
        situation_code = game_data.get("situationCode")
        if situation_code:
            # NHL situation codes indicate power play status
            if "PP" in str(situation_code):
                situation.power_play_active = True
                # Determine which team has power play (requires more detailed parsing)

        home_pp = bool((game_data.get("homeTeam") or {}).get("powerPlay"))
        away_pp = bool((game_data.get("awayTeam") or {}).get("powerPlay"))
        if home_pp != away_pp:
            situation.power_play_active = True
            situation.power_play_team = "home" if home_pp else "away"
        
        return situation
    
    def _get_adaptive_cache_ttl(self, target_date: date) -> int:
        """Get cache TTL based on how current the data is."""
        today = date.today()
        days_diff = (target_date - today).days
        
        if days_diff < 0:  # Past games
            return 3600  # Cache for 1 hour
        elif days_diff == 0:  # Today's games
            return self.cache_ttl  # Use default (5 minutes)
        else:  # Future games  
            return 1800  # Cache for 30 minutes
    
    def _get_emergency_fallback(self, target_date: date) -> List[EnhancedGameSnapshot]:
        """Get emergency fallback data when all other methods fail."""
        if not self._last_known_games or not self._last_successful_fetch:
            print("[warn] No NHL emergency fallback data available")
            return []
        
        # Check if fallback data is too old
        age_minutes = (datetime.now() - self._last_successful_fetch).total_seconds() / 60
        max_fallback_age = int(os.getenv("NHL_MAX_FALLBACK_AGE_MINUTES", "30"))
        
        if age_minutes > max_fallback_age:
            print(f"[warn] NHL emergency fallback data too old ({age_minutes:.1f} minutes)")
            return []
        
        print(f"[info] Using NHL emergency fallback data (age: {age_minutes:.1f} minutes)")
        return self._last_known_games
    
    def get_status(self) -> Dict[str, Any]:
        """Get NHL client status information."""
        circuit_status = self.client.get_circuit_status()
        
        return {
            "sport": "NHL",
            "circuit_breaker": circuit_status,
            "last_successful_fetch": self._last_successful_fetch.isoformat() if self._last_successful_fetch else None,
            "cached_games_count": len(self._last_known_games),
            "cache_dir": str(self.client.cache_dir),
        }
    
    def clear_cache(self, max_age_hours: Optional[int] = 24) -> int:
        """Clear old NHL cache files."""
        return self.client.clear_cache(max_age_hours)
