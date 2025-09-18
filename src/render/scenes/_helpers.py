from __future__ import annotations

from typing import Any, Optional


try:
    from src.sports.base import SportType
except ImportError:  # pragma: no cover - minimal runtime environments
    SportType = None  # type: ignore


def infer_team_sport(snapshot: Any, team: Any) -> Optional[Any]:
    """Best-effort sport lookup for legacy and enhanced snapshots."""

    for source in (team, snapshot):
        if not source:
            continue
        for attr in ("sport", "sport_type"):
            value = getattr(source, attr, None)
            if value is None:
                continue
            if SportType is None:
                return value
            if isinstance(value, SportType):
                return value
            # Accept enum values stored as str-like (e.g. "nhl")
            if isinstance(value, str):
                lowered = value.lower()
                try:
                    return SportType(lowered)
                except Exception:
                    return lowered
    return None

