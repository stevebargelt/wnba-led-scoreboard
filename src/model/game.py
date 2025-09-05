from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum, auto
from typing import Optional


class GameState(Enum):
    PRE = auto()
    LIVE = auto()
    FINAL = auto()


@dataclass
class TeamSide:
    id: Optional[str]
    name: str
    abbr: str
    score: int = 0


@dataclass
class GameSnapshot:
    event_id: str
    start_time_local: datetime
    state: GameState
    period: int
    display_clock: str
    home: TeamSide
    away: TeamSide
    seconds_to_start: int = -1
    status_detail: str = ""

