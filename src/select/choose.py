from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from src.config.types import AppConfig
from src.model.game import GameSnapshot, GameState


def _normalize_name(s: str) -> str:
    return (s or "").strip().lower()


def _matches_favorite(snap: GameSnapshot, fav_name: str, fav_id: Optional[str]) -> bool:
    if fav_id and (snap.home.id == fav_id or snap.away.id == fav_id):
        return True
    favn = _normalize_name(fav_name)
    return _normalize_name(snap.home.name) == favn or _normalize_name(snap.away.name) == favn


def choose_featured_game(cfg: AppConfig, games: List[GameSnapshot], now_local: datetime) -> Optional[GameSnapshot]:
    # Localize start time for comparison
    for g in games:
        g.start_time_local = g.start_time_local.astimezone(cfg.tz)

    # Filter today
    today_games = [g for g in games if g.start_time_local.date() == now_local.date()]
    if not today_games:
        return None

    # For each favorite by order, see if a game exists
    candidates: List[GameSnapshot] = []
    for fav in cfg.favorites:
        for g in today_games:
            if _matches_favorite(g, fav.name, fav.id):
                candidates.append(g)
        if candidates:
            break

    if not candidates:
        return None

    # Prefer LIVE > PRE > FINAL, then earlier start time
    state_rank = {GameState.LIVE: 0, GameState.PRE: 1, GameState.FINAL: 2}
    candidates.sort(key=lambda g: (state_rank.get(g.state, 3), g.start_time_local))

    chosen = candidates[0]

    # Derive seconds_to_start for PRE state
    if chosen.state == GameState.PRE:
        chosen.seconds_to_start = int((chosen.start_time_local - now_local).total_seconds())
    return chosen
