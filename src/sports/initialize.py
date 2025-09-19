"""Initialize sports and leagues registry."""

from .registry import registry
from .definitions import (
    HOCKEY_SPORT,
    BASKETBALL_SPORT,
    SOCCER_SPORT,
    FOOTBALL_SPORT,
    BASEBALL_SPORT,
)
from .leagues import (
    NHL_LEAGUE,
    NHLClient,
    WNBA_LEAGUE,
    WNBAClient,
)


def initialize_sports_registry():
    """Initialize the global sports registry with all sports and leagues."""

    # Register all sports
    registry.register_sport(HOCKEY_SPORT)
    registry.register_sport(BASKETBALL_SPORT)
    registry.register_sport(SOCCER_SPORT)
    registry.register_sport(FOOTBALL_SPORT)
    registry.register_sport(BASEBALL_SPORT)

    # Register leagues with their clients
    registry.register_league(NHL_LEAGUE, NHLClient)
    registry.register_league(WNBA_LEAGUE, WNBAClient)

    # TODO: Add more leagues as they are implemented
    # registry.register_league(NBA_LEAGUE, NBAClient)
    # registry.register_league(PWHL_LEAGUE, PWHLClient)
    # registry.register_league(MLS_LEAGUE, MLSClient)
    # registry.register_league(NWSL_LEAGUE, NWSLClient)
    # registry.register_league(NFL_LEAGUE, NFLClient)
    # registry.register_league(MLB_LEAGUE, MLBClient)

    return registry


def get_initialized_registry():
    """Get the registry, initializing if needed."""
    if not registry.list_sports():
        initialize_sports_registry()
    return registry