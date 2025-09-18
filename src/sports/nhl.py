"""
NHL API client implementation with resilience features.
"""

import os
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Any

from src.data.resilient_client import ResilientHTTPClient
from src.model.sport_game import EnhancedGameSnapshot, SportTeam, GameTiming, SportSituation
from src.model.game import GameState
from src.sports.base import SportClient, SportClientInfo, SportType


STATIC_NHL_TEAMS: List[Dict[str, Any]] = [
    {"id": "NJD", "name": "New Jersey Devils", "displayName": "New Jersey Devils", "abbreviation": "NJD", "conference": "Eastern", "division": "Metropolitan"},
    {"id": "NYI", "name": "New York Islanders", "displayName": "New York Islanders", "abbreviation": "NYI", "conference": "Eastern", "division": "Metropolitan"},
    {"id": "NYR", "name": "New York Rangers", "displayName": "New York Rangers", "abbreviation": "NYR", "conference": "Eastern", "division": "Metropolitan"},
    {"id": "PHI", "name": "Philadelphia Flyers", "displayName": "Philadelphia Flyers", "abbreviation": "PHI", "conference": "Eastern", "division": "Metropolitan"},
    {"id": "PIT", "name": "Pittsburgh Penguins", "displayName": "Pittsburgh Penguins", "abbreviation": "PIT", "conference": "Eastern", "division": "Metropolitan"},
    {"id": "CAR", "name": "Carolina Hurricanes", "displayName": "Carolina Hurricanes", "abbreviation": "CAR", "conference": "Eastern", "division": "Metropolitan"},
    {"id": "CBJ", "name": "Columbus Blue Jackets", "displayName": "Columbus Blue Jackets", "abbreviation": "CBJ", "conference": "Eastern", "division": "Metropolitan"},
    {"id": "WSH", "name": "Washington Capitals", "displayName": "Washington Capitals", "abbreviation": "WSH", "conference": "Eastern", "division": "Metropolitan"},
    {"id": "BOS", "name": "Boston Bruins", "displayName": "Boston Bruins", "abbreviation": "BOS", "conference": "Eastern", "division": "Atlantic"},
    {"id": "BUF", "name": "Buffalo Sabres", "displayName": "Buffalo Sabres", "abbreviation": "BUF", "conference": "Eastern", "division": "Atlantic"},
    {"id": "DET", "name": "Detroit Red Wings", "displayName": "Detroit Red Wings", "abbreviation": "DET", "conference": "Eastern", "division": "Atlantic"},
    {"id": "FLA", "name": "Florida Panthers", "displayName": "Florida Panthers", "abbreviation": "FLA", "conference": "Eastern", "division": "Atlantic"},
    {"id": "MTL", "name": "Montréal Canadiens", "displayName": "Montréal Canadiens", "abbreviation": "MTL", "conference": "Eastern", "division": "Atlantic"},
    {"id": "OTT", "name": "Ottawa Senators", "displayName": "Ottawa Senators", "abbreviation": "OTT", "conference": "Eastern", "division": "Atlantic"},
    {"id": "TBL", "name": "Tampa Bay Lightning", "displayName": "Tampa Bay Lightning", "abbreviation": "TBL", "conference": "Eastern", "division": "Atlantic"},
    {"id": "TOR", "name": "Toronto Maple Leafs", "displayName": "Toronto Maple Leafs", "abbreviation": "TOR", "conference": "Eastern", "division": "Atlantic"},
    {"id": "ARI", "name": "Arizona Coyotes", "displayName": "Arizona Coyotes", "abbreviation": "ARI", "conference": "Western", "division": "Central"},
    {"id": "CHI", "name": "Chicago Blackhawks", "displayName": "Chicago Blackhawks", "abbreviation": "CHI", "conference": "Western", "division": "Central"},
    {"id": "COL", "name": "Colorado Avalanche", "displayName": "Colorado Avalanche", "abbreviation": "COL", "conference": "Western", "division": "Central"},
    {"id": "DAL", "name": "Dallas Stars", "displayName": "Dallas Stars", "abbreviation": "DAL", "conference": "Western", "division": "Central"},
    {"id": "MIN", "name": "Minnesota Wild", "displayName": "Minnesota Wild", "abbreviation": "MIN", "conference": "Western", "division": "Central"},
    {"id": "NSH", "name": "Nashville Predators", "displayName": "Nashville Predators", "abbreviation": "NSH", "conference": "Western", "division": "Central"},
    {"id": "STL", "name": "St. Louis Blues", "displayName": "St. Louis Blues", "abbreviation": "STL", "conference": "Western", "division": "Central"},
    {"id": "WPG", "name": "Winnipeg Jets", "displayName": "Winnipeg Jets", "abbreviation": "WPG", "conference": "Western", "division": "Central"},
    {"id": "ANA", "name": "Anaheim Ducks", "displayName": "Anaheim Ducks", "abbreviation": "ANA", "conference": "Western", "division": "Pacific"},
    {"id": "CGY", "name": "Calgary Flames", "displayName": "Calgary Flames", "abbreviation": "CGY", "conference": "Western", "division": "Pacific"},
    {"id": "EDM", "name": "Edmonton Oilers", "displayName": "Edmonton Oilers", "abbreviation": "EDM", "conference": "Western", "division": "Pacific"},
    {"id": "LAK", "name": "Los Angeles Kings", "displayName": "Los Angeles Kings", "abbreviation": "LAK", "conference": "Western", "division": "Pacific"},
    {"id": "SJS", "name": "San Jose Sharks", "displayName": "San Jose Sharks", "abbreviation": "SJS", "conference": "Western", "division": "Pacific"},
    {"id": "SEA", "name": "Seattle Kraken", "displayName": "Seattle Kraken", "abbreviation": "SEA", "conference": "Western", "division": "Pacific"},
    {"id": "VAN", "name": "Vancouver Canucks", "displayName": "Vancouver Canucks", "abbreviation": "VAN", "conference": "Western", "division": "Pacific"},
    {"id": "VGK", "name": "Vegas Golden Knights", "displayName": "Vegas Golden Knights", "abbreviation": "VGK", "conference": "Western", "division": "Pacific"}
]


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
        
        # Fetch data with resilience features
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

        # Preferred source: NHL stats REST API (more stable)
        data = self.client.get(
            endpoint="https://api.nhle.com/stats/rest/en/team",
            cache_ttl=86400,
            use_cache=True,
            fallback_to_stale=True,
        )

        if isinstance(data, dict):
            for row in data.get("data", []):
                team_info = {
                    "id": str(row.get("teamId") or row.get("teamAbbrev") or ""),
                    "name": row.get("teamFullName") or row.get("teamName") or "",
                    "displayName": row.get("teamCommonName") or row.get("teamShortName") or "",
                    "abbreviation": (row.get("teamAbbrev") or "").upper(),
                    "conference": row.get("conferenceName") or "",
                    "division": row.get("divisionName") or "",
                }
                if team_info["id"] and team_info["abbreviation"]:
                    teams.append(team_info)

        if not teams:
            # Secondary fallback: legacy public stats API
            stats_data = self.client.get(
                endpoint="https://statsapi.web.nhl.com/api/v1/teams",
                cache_ttl=86400,
                use_cache=True,
                fallback_to_stale=True,
            )
            if isinstance(stats_data, dict):
                for team in stats_data.get("teams", []):
                    team_info = {
                        "id": str(team.get("id") or team.get("abbreviation") or ""),
                        "name": team.get("name", ""),
                        "displayName": team.get("teamName", ""),
                        "abbreviation": (team.get("abbreviation") or "").upper(),
                        "conference": (team.get("conference") or {}).get("name", ""),
                        "division": (team.get("division") or {}).get("name", ""),
                    }
                    if team_info["id"] and team_info["abbreviation"]:
                        teams.append(team_info)

        if teams:
            return teams

        # Offline fallback: bundled team list
        self.used_static_fallback = True
        print("[info] Using bundled NHL team list fallback")
        return [dict(team) for team in STATIC_NHL_TEAMS]
    
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
        home_team = self._parse_nhl_team(game_data.get("homeTeam", {}), "home")
        away_team = self._parse_nhl_team(game_data.get("awayTeam", {}), "away") 
        
        if not home_team or not away_team:
            return None
        
        # Parse game state
        game_state = self._parse_nhl_game_state(game_data)
        
        # Parse timing information
        timing = self._parse_nhl_timing(game_data)
        
        # Parse start time
        start_time_str = game_data.get("startTimeUTC")
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
            status_detail=game_data.get("gameStatusText", ""),
            venue=game_data.get("venue", {}).get("default", ""),
            raw_api_data=game_data,
        )
    
    def _parse_nhl_team(self, team_data: Dict[str, Any], home_away: str) -> Optional[SportTeam]:
        """Parse NHL team data."""
        if not team_data:
            return None
        
        team_id = team_data.get("id")
        if team_id is None:
            return None
        
        # Get team colors (if available)
        colors = {}
        if "primaryColor" in team_data:
            colors["primary"] = team_data["primaryColor"]
        if "secondaryColor" in team_data:
            colors["secondary"] = team_data["secondaryColor"]
        
        return SportTeam(
            id=str(team_id),
            name=team_data.get("name", {}).get("default", "Unknown Team"),
            abbr=team_data.get("triCode", "UNK"),
            score=int(team_data.get("score", 0)),
            sport=SportType.NHL,
            colors=colors,
            logo_url=team_data.get("logo", ""),
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
        period = int(game_data.get("period", 1))
        clock = game_data.get("clock", {}).get("timeRemaining", "20:00")
        
        # Determine if overtime/shootout
        is_overtime = period > 3
        is_shootout = game_data.get("gameState") == "SO" or "shootout" in game_data.get("gameStatusText", "").lower()
        
        # NHL period naming
        if period <= 3:
            period_name = f"P{period}"
        elif is_shootout:
            period_name = "SO"
        else:
            period_name = "OT"
        
        return GameTiming(
            current_period=period,
            period_name=period_name,
            period_max=3,  # NHL regulation periods
            display_clock=clock,
            clock_running=game_data.get("clock", {}).get("running", False),
            is_intermission=game_data.get("gameState") == "INT",
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
