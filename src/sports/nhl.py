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
        # Try to fetch current teams data
        data = self.client.get(
            endpoint="teams",
            cache_ttl=86400,  # Cache teams for 24 hours
            use_cache=True,
            fallback_to_stale=True,
        )
        
        if data is None:
            print("[warn] Could not fetch NHL team data")
            return []
        
        teams = []
        for team_data in data.get("teams", []):
            team_info = {
                "id": str(team_data.get("id", "")),
                "name": team_data.get("fullName", ""),
                "displayName": team_data.get("teamName", ""),
                "abbreviation": team_data.get("triCode", ""),
                "conference": team_data.get("conference", {}).get("name", ""),
                "division": team_data.get("division", {}).get("name", ""),
                "colors": {
                    "primary": team_data.get("primaryColor", "#000000"),
                    "secondary": team_data.get("secondaryColor", "#FFFFFF"),
                },
                "venue": {
                    "name": team_data.get("venue", {}).get("default", ""),
                    "city": team_data.get("venue", {}).get("city", ""),
                    "timezone": team_data.get("venue", {}).get("timeZone", {}).get("id", ""),
                }
            }
            teams.append(team_info)
        
        return teams
    
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