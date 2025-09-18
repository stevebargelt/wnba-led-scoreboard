from __future__ import annotations

import os
from datetime import date, datetime
from typing import Any, List
from dateutil.parser import parse as parse_datetime

import requests

from src.model.game import GameSnapshot, GameState, TeamSide


ESPN_SCOREBOARD_URL = "http://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard"


def fetch_scoreboard(d: date) -> List[GameSnapshot]:
    """Fetch the daily scoreboard and map to GameSnapshot list.

    Note: ESPN returns times in ISO UTC. We do not localize here; caller should handle.
    """
    datestr = d.strftime("%Y%m%d")
    params = {"dates": datestr}
    timeout = float(os.getenv("HTTP_TIMEOUT", "5"))
    r = requests.get(ESPN_SCOREBOARD_URL, params=params, timeout=timeout)
    r.raise_for_status()
    data = r.json()

    out: List[GameSnapshot] = []
    for ev in data.get("events", []):
        event_id = ev.get("id")
        comp = (ev.get("competitions") or [{}])[0]
        competitors = comp.get("competitors", [])
        home_raw = next((c for c in competitors if c.get("homeAway") == "home"), None)
        away_raw = next((c for c in competitors if c.get("homeAway") == "away"), None)
        if not home_raw or not away_raw:
            continue

        def team_side(raw: dict) -> TeamSide:
            team = raw.get("team", {})
            return TeamSide(
                id=str(team.get("id")) if team.get("id") is not None else None,
                name=team.get("displayName") or team.get("name") or "",
                abbr=team.get("abbreviation") or (team.get("shortDisplayName") or "").upper(),
                score=int(raw.get("score") or 0),
            )

        status = comp.get("status", {}).get("type", {})
        state_str = (status.get("state") or "").lower()
        if state_str == "pre":
            state = GameState.PRE
        elif state_str == "post":
            state = GameState.FINAL
        else:
            state = GameState.LIVE

        display_clock = comp.get("status", {}).get("displayClock") or ""
        period = int(comp.get("status", {}).get("period") or 0)
        start_time_iso = ev.get("date")
        # ESPN encodes in ISO 8601 UTC
        # Use dateutil for robust parsing of various ISO formats
        start_dt_utc = parse_datetime(start_time_iso)

        home = team_side(home_raw)
        away = team_side(away_raw)

        snap = GameSnapshot(
            event_id=str(event_id),
            start_time_local=start_dt_utc,  # caller can .astimezone(local)
            state=state,
            period=period,
            display_clock=display_clock,
            home=home,
            away=away,
            status_detail=status.get("detail") or "",
        )
        out.append(snap)

    return out

