from __future__ import annotations

from typing import Any, Optional


def infer_team_sport(snapshot: Any, team: Any) -> Optional[str]:
    """Best-effort sport/league lookup for legacy and enhanced snapshots."""

    for source in (team, snapshot):
        if not source:
            continue
        for attr in ("league_code", "sport", "sport_type"):
            value = getattr(source, attr, None)
            if value is None:
                continue
            # Return string league codes directly
            if isinstance(value, str):
                return value.lower()
    return None

