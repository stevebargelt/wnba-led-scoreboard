from __future__ import annotations

from src.model.game import GameSnapshot


def get_sport_code(snap: GameSnapshot) -> str:
    """Get sport code from snapshot."""
    return snap.sport.code


def get_league_code(snap: GameSnapshot) -> str:
    """Get league code from snapshot."""
    return snap.league.code


def infer_team_sport(snapshot: GameSnapshot, team: Any) -> str:
    """Get sport code from unified model (for backward compatibility)."""
    # Now we always have sport/league in the snapshot
    return snapshot.sport.code

