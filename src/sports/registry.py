"""Central registry for sports and leagues."""

from typing import Dict, Optional, Type, List
from .models.sport_config import SportConfig
from .models.league_config import LeagueConfig


class SportRegistry:
    """Central registry for sports and leagues."""

    def __init__(self):
        self._sports: Dict[str, SportConfig] = {}
        self._leagues: Dict[str, LeagueConfig] = {}
        self._league_clients: Dict[str, Type['LeagueClient']] = {}

    def register_sport(self, sport: SportConfig) -> None:
        """Register a sport configuration."""
        self._sports[sport.code] = sport

    def register_league(self, league: LeagueConfig, client_class: Optional[Type['LeagueClient']] = None) -> None:
        """Register a league with its API client."""
        if league.sport_code not in self._sports:
            raise ValueError(f"Sport {league.sport_code} not registered. Register sport before league.")

        self._leagues[league.code] = league
        if client_class:
            self._league_clients[league.code] = client_class

    def get_sport(self, sport_code: str) -> Optional[SportConfig]:
        """Get sport configuration."""
        return self._sports.get(sport_code)

    def get_league(self, league_code: str) -> Optional[LeagueConfig]:
        """Get league configuration."""
        return self._leagues.get(league_code)

    def get_league_client_class(self, league_code: str) -> Optional[Type['LeagueClient']]:
        """Get league API client class."""
        return self._league_clients.get(league_code)

    def get_leagues_for_sport(self, sport_code: str) -> List[LeagueConfig]:
        """Get all leagues for a sport."""
        return [
            league for league in self._leagues.values()
            if league.sport_code == sport_code
        ]

    def get_enabled_leagues(self, enabled_list: List[str]) -> List[LeagueConfig]:
        """Get leagues that are in the enabled list."""
        return [
            self._leagues[code] for code in enabled_list
            if code in self._leagues
        ]

    def list_sports(self) -> List[SportConfig]:
        """List all registered sports."""
        return list(self._sports.values())

    def list_leagues(self) -> List[LeagueConfig]:
        """List all registered leagues."""
        return list(self._leagues.values())

    def get_sport_for_league(self, league_code: str) -> Optional[SportConfig]:
        """Get the sport configuration for a league."""
        league = self.get_league(league_code)
        if league:
            return self.get_sport(league.sport_code)
        return None


# Global registry instance
registry = SportRegistry()


def get_registry() -> SportRegistry:
    """Get the global sport registry."""
    return registry