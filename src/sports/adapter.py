"""Adapter to integrate new sports/leagues system with existing codebase."""

from datetime import date
from typing import List, Optional

from .initialize import get_initialized_registry
from .clients.base import LeagueGameSnapshot
from src.model.game import GameSnapshot


def fetch_games_for_league(league_code: str, target_date: date) -> List[GameSnapshot]:
    """
    Fetch games for a specific league and convert to legacy GameSnapshot.

    Args:
        league_code: League code (e.g., "nhl", "wnba")
        target_date: Date to fetch games for

    Returns:
        List of GameSnapshot objects (legacy format)
    """
    registry = get_initialized_registry()

    # Get league and sport
    league = registry.get_league(league_code)
    if not league:
        print(f"[warn] League {league_code} not found in registry")
        return []

    sport = registry.get_sport_for_league(league_code)
    if not sport:
        print(f"[warn] Sport for league {league_code} not found")
        return []

    # Get client class and instantiate
    client_class = registry.get_league_client_class(league_code)
    if not client_class:
        print(f"[warn] No client registered for league {league_code}")
        return []

    # Create client and fetch games
    client = client_class(sport)
    league_games = client.fetch_games(target_date)

    # Convert to legacy format
    legacy_games = []
    for game in league_games:
        legacy_game = convert_to_legacy_snapshot(game)
        if legacy_game:
            legacy_games.append(legacy_game)

    return legacy_games


def convert_to_legacy_snapshot(league_game: LeagueGameSnapshot) -> Optional[GameSnapshot]:
    """
    Convert LeagueGameSnapshot to legacy GameSnapshot format.

    Args:
        league_game: New format game snapshot

    Returns:
        Legacy GameSnapshot object
    """
    try:
        return GameSnapshot(
            event_id=league_game.event_id,
            start_time_local=league_game.start_time_local,
            state=league_game.state,
            period=league_game.current_period,
            display_clock=league_game.display_clock,
            home=league_game.home,
            away=league_game.away,
            seconds_to_start=league_game.seconds_to_start,
            status_detail=league_game.status_detail or league_game.period_name,
        )
    except Exception as e:
        print(f"[error] Failed to convert game snapshot: {e}")
        return None


def fetch_all_games(enabled_leagues: List[str], target_date: date) -> List[GameSnapshot]:
    """
    Fetch games for all enabled leagues.

    Args:
        enabled_leagues: List of league codes to fetch
        target_date: Date to fetch games for

    Returns:
        Combined list of GameSnapshot objects
    """
    all_games = []

    for league_code in enabled_leagues:
        games = fetch_games_for_league(league_code, target_date)
        all_games.extend(games)

    return all_games