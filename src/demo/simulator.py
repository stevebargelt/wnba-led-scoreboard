from __future__ import annotations

import random
from dataclasses import replace
from datetime import datetime, timedelta
from typing import Optional

from src.config.types import AppConfig
from src.model.game import GameSnapshot, GameState, TeamSide


class DemoSimulator:
    """Simple time-based simulator for a single WNBA game.

    Behavior:
    - Starts in PRE for ~45s, then goes LIVE for 4 periods of 10 minutes each.
    - Advances clock based on wall time; bumps score occasionally (10–30s).
    - Ends in FINAL and keeps showing for the day.
    """

    QUARTER_LEN = 10 * 60  # 10 minutes

    def __init__(self, cfg: AppConfig):
        self.cfg = cfg
        now = datetime.now(cfg.tz)
        self.start_time = now + timedelta(seconds=45)
        self.random = random.Random()
        self.random.seed(int(now.timestamp()))

        # Choose teams from favorites if possible
        away_abbr = None
        home_abbr = None
        away_name = None
        home_name = None
        away_id = None
        home_id = None
        if cfg.favorites:
            away = cfg.favorites[0]
            away_abbr = away.abbr or (away.name[:3].upper() if away.name else "AWY")
            away_name = away.name or "Away"
            away_id = away.id or "AWY"
            if len(cfg.favorites) > 1:
                home = cfg.favorites[1]
                home_abbr = home.abbr or (home.name[:3].upper() if home.name else "HOM")
                home_name = home.name or "Home"
                home_id = home.id or "HOM"
        away_abbr = away_abbr or "AWY"
        home_abbr = home_abbr or "HOM"
        away_name = away_name or "Away"
        home_name = home_name or "Home"
        away_id = away_id or "AWY"
        home_id = home_id or "HOM"

        self.base = GameSnapshot(
            event_id="demo",
            start_time_local=self.start_time,
            state=GameState.PRE,
            period=0,
            display_clock="",
            home=TeamSide(id=home_id, name=home_name, abbr=home_abbr, score=0),
            away=TeamSide(id=away_id, name=away_name, abbr=away_abbr, score=0),
            seconds_to_start=45,
            status_detail="Demo",
        )

        self.next_score_ts = self.start_time  # will schedule after tip

    def _format_clock(self, secs: int) -> str:
        secs = max(0, secs)
        m, s = divmod(secs, 60)
        return f"{m:02d}:{s:02d}"

    def get_snapshot(self, now_local: datetime) -> Optional[GameSnapshot]:
        # PRE
        if now_local < self.start_time:
            secs_to_start = int((self.start_time - now_local).total_seconds())
            return replace(self.base, state=GameState.PRE, period=0, display_clock="", seconds_to_start=secs_to_start)

        # LIVE or FINAL
        elapsed = int((now_local - self.start_time).total_seconds())
        period = min(4, 1 + elapsed // self.QUARTER_LEN)
        period_elapsed = elapsed % self.QUARTER_LEN
        remaining = self.QUARTER_LEN - period_elapsed

        # Score bump scheduling (only during LIVE)
        if period <= 4:
            if now_local >= self.next_score_ts:
                # Randomly assign 1, 2, or 3 points to a team
                pts = self.random.choice([1, 2, 3, 2])
                if self.random.random() < 0.5:
                    self.base.away.score += pts
                else:
                    self.base.home.score += pts
                # Next score in 10–30 seconds
                self.next_score_ts = now_local + timedelta(seconds=self.random.randint(10, 30))

        if period <= 4:
            return replace(
                self.base,
                state=GameState.LIVE,
                period=period,
                display_clock=self._format_clock(remaining),
                seconds_to_start=-1,
                status_detail=f"Q{period}",
            )
        else:
            # FINAL
            return replace(
                self.base,
                state=GameState.FINAL,
                period=4,
                display_clock="00:00",
                seconds_to_start=-1,
                status_detail="Final",
            )

