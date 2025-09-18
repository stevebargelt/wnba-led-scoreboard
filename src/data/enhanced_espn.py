"""
Enhanced ESPN API client with resilience features.
"""

import os
from datetime import date, datetime, timedelta
from typing import List, Optional
from dateutil.parser import parse as parse_datetime

from src.data.resilient_client import ResilientHTTPClient
from src.model.game import GameSnapshot, GameState, TeamSide


class EnhancedESPNClient:
    """ESPN API client with resilience, caching, and fallback strategies."""
    
    def __init__(self, cache_dir: str = "cache/espn"):
        # Get configuration from environment
        self.base_timeout = float(os.getenv("HTTP_TIMEOUT", "10"))
        self.cache_ttl = int(os.getenv("ESPN_CACHE_TTL", "300"))  # 5 minutes
        self.stale_cache_max_age = int(os.getenv("ESPN_STALE_CACHE_MAX_AGE", "3600"))  # 1 hour
        self.circuit_failure_threshold = int(os.getenv("ESPN_CIRCUIT_FAILURE_THRESHOLD", "3"))
        
        # Initialize resilient HTTP client
        self.client = ResilientHTTPClient(
            base_url="http://site.api.espn.com/apis/site/v2/sports/basketball/wnba",
            cache_dir=cache_dir,
            circuit_failure_threshold=self.circuit_failure_threshold,
            circuit_recovery_timeout=60,
            cache_ttl=self.cache_ttl,
            max_retries=3,
            backoff_factor=1.5,
            timeout=self.base_timeout,
        )
        
        # Keep track of last successful data for emergency fallback
        self._last_known_games: List[GameSnapshot] = []
        self._last_successful_fetch: Optional[datetime] = None
    
    def fetch_scoreboard(self, target_date: date) -> List[GameSnapshot]:
        """
        Fetch scoreboard with enhanced reliability.
        
        Returns:
            List of GameSnapshot objects, or fallback data if API fails
        """
        datestr = target_date.strftime("%Y%m%d")
        params = {"dates": datestr}
        
        # Determine cache TTL based on how recent the date is
        cache_ttl = self._get_adaptive_cache_ttl(target_date)
        
        # Fetch data with resilience features
        data = self.client.get(
            endpoint="scoreboard",
            params=params,
            cache_ttl=cache_ttl,
            use_cache=True,
            fallback_to_stale=True,
        )
        
        if data is None:
            # Ultimate fallback: return last known data if recent enough
            return self._get_emergency_fallback(target_date)
        
        # Parse the ESPN response
        try:
            games = self._parse_espn_response(data, target_date)
            
            # Update our emergency fallback data
            if games:
                self._last_known_games = games
                self._last_successful_fetch = datetime.now()
            
            return games
            
        except Exception as e:
            print(f"[error] Failed to parse ESPN response: {e}")
            return self._get_emergency_fallback(target_date)
    
    def _get_adaptive_cache_ttl(self, target_date: date) -> int:
        """Get cache TTL based on how current the data is."""
        today = date.today()
        days_diff = (target_date - today).days
        
        if days_diff < 0:  # Past games
            return 3600  # Cache for 1 hour (scores unlikely to change)
        elif days_diff == 0:  # Today's games
            return self.cache_ttl  # Use default (5 minutes)
        else:  # Future games
            return 1800  # Cache for 30 minutes (schedules can change)
    
    def _parse_espn_response(self, data: dict, target_date: date) -> List[GameSnapshot]:
        """Parse ESPN API response into GameSnapshot objects."""
        games: List[GameSnapshot] = []
        
        for event in data.get("events", []):
            try:
                game = self._parse_single_game(event)
                if game:
                    games.append(game)
            except Exception as e:
                print(f"[warn] Failed to parse game {event.get('id', 'unknown')}: {e}")
                continue
        
        return games
    
    def _parse_single_game(self, event: dict) -> Optional[GameSnapshot]:
        """Parse a single game event from ESPN data."""
        event_id = event.get("id")
        if not event_id:
            return None
        
        # Get competition data
        competitions = event.get("competitions", [])
        if not competitions:
            return None
        
        comp = competitions[0]
        competitors = comp.get("competitors", [])
        
        # Find home and away teams
        home_raw = next((c for c in competitors if c.get("homeAway") == "home"), None)
        away_raw = next((c for c in competitors if c.get("homeAway") == "away"), None)
        
        if not home_raw or not away_raw:
            return None
        
        # Parse team information
        home = self._parse_team(home_raw)
        away = self._parse_team(away_raw)
        
        # Parse game status
        status = comp.get("status", {})
        state = self._parse_game_state(status)
        
        # Parse timing information
        display_clock = status.get("displayClock") or ""
        period = int(status.get("period") or 0)
        
        # Parse start time
        start_time_iso = event.get("date")
        if not start_time_iso:
            return None
        
        try:
            # Use dateutil for robust parsing of various ISO formats
            start_dt_utc = parse_datetime(start_time_iso)
        except (ValueError, TypeError):
            return None
        
        # Calculate seconds to start for pregame
        seconds_to_start = -1
        if state == GameState.PRE:
            now_utc = datetime.now(start_dt_utc.tzinfo)
            delta = start_dt_utc - now_utc
            seconds_to_start = max(0, int(delta.total_seconds()))
        
        return GameSnapshot(
            event_id=str(event_id),
            start_time_local=start_dt_utc,
            state=state,
            period=period,
            display_clock=display_clock,
            home=home,
            away=away,
            seconds_to_start=seconds_to_start,
            status_detail=status.get("detail") or "",
        )
    
    def _parse_team(self, competitor: dict) -> TeamSide:
        """Parse team information from competitor data."""
        team = competitor.get("team", {})
        return TeamSide(
            id=str(team.get("id")) if team.get("id") is not None else None,
            name=team.get("displayName") or team.get("name") or "Unknown Team",
            abbr=team.get("abbreviation") or (team.get("shortDisplayName") or "").upper() or "UNK",
            score=int(competitor.get("score") or 0),
        )
    
    def _parse_game_state(self, status: dict) -> GameState:
        """Parse game state from status information."""
        status_type = status.get("type", {})
        state_str = (status_type.get("state") or "").lower()
        
        if state_str == "pre":
            return GameState.PRE
        elif state_str == "post":
            return GameState.FINAL
        else:
            return GameState.LIVE
    
    def _get_emergency_fallback(self, target_date: date) -> List[GameSnapshot]:
        """
        Get emergency fallback data when all other methods fail.
        
        Returns last known games if they're recent enough, otherwise empty list.
        """
        if not self._last_known_games or not self._last_successful_fetch:
            print("[warn] No emergency fallback data available")
            return []
        
        # Check if fallback data is too old
        age_minutes = (datetime.now() - self._last_successful_fetch).total_seconds() / 60
        max_fallback_age = int(os.getenv("ESPN_MAX_FALLBACK_AGE_MINUTES", "30"))
        
        if age_minutes > max_fallback_age:
            print(f"[warn] Emergency fallback data too old ({age_minutes:.1f} minutes)")
            return []
        
        print(f"[info] Using emergency fallback data (age: {age_minutes:.1f} minutes)")
        return self._last_known_games
    
    def get_status(self) -> dict:
        """Get client status information."""
        circuit_status = self.client.get_circuit_status()
        
        return {
            "circuit_breaker": circuit_status,
            "last_successful_fetch": self._last_successful_fetch.isoformat() if self._last_successful_fetch else None,
            "cached_games_count": len(self._last_known_games),
            "cache_dir": str(self.client.cache_dir),
        }
    
    def clear_cache(self, max_age_hours: Optional[int] = 24) -> int:
        """Clear old cache files."""
        return self.client.clear_cache(max_age_hours)


# Legacy compatibility function
def fetch_scoreboard(d: date) -> List[GameSnapshot]:
    """
    Legacy function for backward compatibility.
    
    This maintains the same interface as the original espn.py
    but uses the enhanced client internally.
    """
    # Use a module-level client instance for efficiency
    if not hasattr(fetch_scoreboard, '_client'):
        fetch_scoreboard._client = EnhancedESPNClient()
    
    return fetch_scoreboard._client.fetch_scoreboard(d)