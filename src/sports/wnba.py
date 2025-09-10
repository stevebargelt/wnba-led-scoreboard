"""
WNBA sport client implementation - adapter for existing ESPN client.
"""

from datetime import date, datetime
from typing import Dict, List, Optional, Any

from src.data.enhanced_espn import EnhancedESPNClient
from src.model.sport_game import EnhancedGameSnapshot, convert_legacy_to_enhanced
from src.sports.base import SportClient, SportClientInfo, SportType


class WNBAClient(SportClient):
    """WNBA client adapter that wraps existing ESPN client."""
    
    def __init__(self, cache_dir: str = "cache/espn"):
        # Use existing enhanced ESPN client
        self.espn_client = EnhancedESPNClient(cache_dir)
    
    def get_sport_info(self) -> SportClientInfo:
        """Get WNBA client information."""
        return SportClientInfo(
            sport_type=SportType.WNBA,
            name="ESPN WNBA API",
            api_base_url="http://site.api.espn.com/apis/site/v2/sports/basketball/wnba",
            default_cache_ttl=300,  # 5 minutes
            supports_live_updates=True,
            supports_schedules=True,
            rate_limit_per_minute=120,  # Conservative estimate
        )
    
    def fetch_games(self, target_date: date) -> List[EnhancedGameSnapshot]:
        """
        Fetch WNBA games for the target date.
        
        Uses existing ESPN client and converts to new format.
        """
        # Use existing ESPN client to fetch games
        legacy_games = self.espn_client.fetch_scoreboard(target_date)
        
        # Convert legacy games to enhanced format
        enhanced_games = []
        for legacy_game in legacy_games:
            try:
                enhanced_game = convert_legacy_to_enhanced(legacy_game, SportType.WNBA)
                enhanced_games.append(enhanced_game)
            except Exception as e:
                print(f"[warn] Failed to convert WNBA game {legacy_game.event_id}: {e}")
                continue
        
        return enhanced_games
    
    def fetch_team_info(self) -> List[Dict[str, Any]]:
        """
        Fetch WNBA team information from assets.
        
        Returns:
            List of team dictionaries with WNBA team data
        """
        import json
        from pathlib import Path
        
        # Read from existing teams.json asset file
        teams_file = Path("assets/teams.json")
        if not teams_file.exists():
            print("[warn] WNBA teams.json not found - run fetch_wnba_assets.py")
            return []
        
        try:
            with teams_file.open() as f:
                teams_data = json.load(f)
            
            # Convert to standardized format
            standardized_teams = []
            for team in teams_data:
                team_info = {
                    "id": str(team.get("id", "")),
                    "name": team.get("displayName", ""),
                    "displayName": team.get("displayName", ""),
                    "abbreviation": team.get("abbreviation", ""),
                    "conference": team.get("conference", ""),
                    "colors": {
                        "primary": team.get("color", {}).get("primary", "#000000"),
                        "secondary": team.get("color", {}).get("secondary", "#FFFFFF"),
                    },
                    "logo_url": team.get("logo", ""),
                    "sport": "wnba",
                }
                standardized_teams.append(team_info)
            
            return standardized_teams
            
        except (json.JSONDecodeError, IOError) as e:
            print(f"[error] Failed to read WNBA teams data: {e}")
            return []
    
    def get_status(self) -> Dict[str, Any]:
        """Get WNBA client status (delegates to ESPN client)."""
        espn_status = self.espn_client.get_status()
        
        return {
            "sport": "WNBA",
            **espn_status
        }
    
    def clear_cache(self, max_age_hours: Optional[int] = 24) -> int:
        """Clear WNBA cache (delegates to ESPN client)."""
        return self.espn_client.clear_cache(max_age_hours)