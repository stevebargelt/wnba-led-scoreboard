from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Iterable, List, Optional, Sequence

from zoneinfo import ZoneInfo

from src.config.multi_sport_types import MultiSportAppConfig
from src.config.types import AppConfig, FavoriteTeam
from src.model.game import GameSnapshot, GameState, TeamSide
from src.model.sport_game import EnhancedGameSnapshot, GameTiming, SportTeam
from src.sports.base import SportType

DEFAULT_ROTATION_SECONDS = 120
DEFAULT_PREGAME_SECONDS = 45


@dataclass
class DemoOptions:
    """Runtime options for demo mode selection."""

    rotation_seconds: int = DEFAULT_ROTATION_SECONDS
    forced_sports: Optional[List[SportType]] = None


def _fallback_identifier(name: str, default: str) -> str:
    if not name:
        return default
    cleaned = "".join(ch for ch in name.upper() if ch.isalpha())
    return (cleaned or default)[:3]


def _favorite_to_team(
    sport: SportType,
    favorite: Optional[FavoriteTeam],
    default_name: str,
    default_id: str,
    default_abbr: str,
) -> SportTeam:
    if favorite is None:
        return SportTeam(
            id=default_id,
            name=default_name,
            abbr=default_abbr,
            score=0,
            sport=sport,
        )

    name = favorite.name or default_name
    abbr = favorite.abbr or _fallback_identifier(name, default_abbr)
    team_id = favorite.id or abbr
    return SportTeam(
        id=str(team_id),
        name=name,
        abbr=abbr,
        score=0,
        sport=sport,
    )


class BaseSportDemo:
    """Abstract base class encapsulating common demo behaviour."""

    pregame_seconds = DEFAULT_PREGAME_SECONDS

    def __init__(
        self,
        sport: SportType,
        tz: ZoneInfo,
        favorites: Sequence[FavoriteTeam],
        *,
        rng: Optional[random.Random] = None,
    ) -> None:
        self.sport = sport
        self.tz = tz
        self._favorites = list(favorites)
        self.rng = rng or random.Random()
        self._home: SportTeam
        self._away: SportTeam
        self._start_time: datetime
        self._next_score_time: datetime
        self._final_label: str = "Final"
        self.reset(datetime.now(self.tz))

    def reset(self, now_local: datetime) -> None:
        away_fav = self._favorites[0] if self._favorites else None
        home_fav = self._favorites[1] if len(self._favorites) > 1 else None
        self._away = _favorite_to_team(self.sport, away_fav, "Away", "demo-away", "AWY")
        self._home = _favorite_to_team(self.sport, home_fav, "Home", "demo-home", "HOM")
        self._home.score = 0
        self._away.score = 0
        self._start_time = now_local + timedelta(seconds=self.pregame_seconds)
        self._next_score_time = self._start_time
        self._final_label = "Final"
        self._reset_internal(now_local)

    def get_snapshot(self, now_local: datetime) -> Optional[GameSnapshot]:
        enhanced = self._build_snapshot(now_local)
        if enhanced is None:
            return None
        return enhanced.to_legacy_game_snapshot()

    def _schedule_next_score(self, now_local: datetime, *, minimum: int, maximum: int) -> None:
        delta = self.rng.randint(minimum, maximum)
        self._next_score_time = now_local + timedelta(seconds=delta)

    def _maybe_award_points(self, now_local: datetime, choices: Sequence[int]) -> None:
        if now_local >= self._next_score_time:
            pts = self.rng.choice(list(choices))
            target = self._home if self.rng.random() < 0.5 else self._away
            target.score += pts
            self._schedule_next_score(now_local, minimum=10, maximum=30)

    # --- hooks for subclasses -------------------------------------------------

    def _reset_internal(self, now_local: datetime) -> None:  # pragma: no cover - optional override
        """Allow subclasses to seed additional state on reset."""

    def _build_snapshot(self, now_local: datetime) -> Optional[EnhancedGameSnapshot]:
        raise NotImplementedError


class WNBADemoSimulator(BaseSportDemo):
    """WNBA-style demo (legacy behaviour)."""

    period_seconds = 10 * 60
    period_count = 4

    def _build_snapshot(self, now_local: datetime) -> Optional[EnhancedGameSnapshot]:
        if now_local < self._start_time:
            seconds_to_start = int((self._start_time - now_local).total_seconds())
            return self._make_snapshot(
                state=GameState.PRE,
                period=0,
                seconds_to_start=seconds_to_start,
                display_clock="",
                period_name="PRE",
                is_overtime=False,
            )

        elapsed = int((now_local - self._start_time).total_seconds())
        period_index = min(elapsed // self.period_seconds, self.period_count)

        if period_index >= self.period_count:
            return self._make_snapshot(
                state=GameState.FINAL,
                period=self.period_count,
                seconds_to_start=-1,
                display_clock="00:00",
                period_name=self._final_label,
                is_overtime=False,
            )

        self._maybe_award_points(now_local, choices=[1, 2, 3])

        remaining = self.period_seconds - (elapsed % self.period_seconds)
        clock = self._format_clock(remaining)
        period_number = period_index + 1
        return self._make_snapshot(
            state=GameState.LIVE,
            period=period_number,
            seconds_to_start=-1,
            display_clock=clock,
            period_name=f"Q{period_number}",
            is_overtime=False,
        )

    def _format_clock(self, seconds: int) -> str:
        seconds = max(0, seconds)
        minutes, secs = divmod(seconds, 60)
        return f"{minutes:02d}:{secs:02d}"

    def _make_snapshot(
        self,
        *,
        state: GameState,
        period: int,
        seconds_to_start: int,
        display_clock: str,
        period_name: str,
        is_overtime: bool,
    ) -> EnhancedGameSnapshot:
        timing = GameTiming(
            current_period=period,
            period_name=period_name,
            period_max=self.period_count,
            display_clock=display_clock,
            clock_running=state == GameState.LIVE,
            is_intermission=False,
            is_overtime=is_overtime,
            is_shootout=False,
        )
        return EnhancedGameSnapshot(
            sport=self.sport,
            event_id=f"{self.sport.value}-demo",
            start_time_local=self._start_time,
            state=state,
            home=self._home,
            away=self._away,
            timing=timing,
            seconds_to_start=seconds_to_start,
            status_detail=period_name if state != GameState.FINAL else self._final_label,
        )


class NHLDemoSimulator(BaseSportDemo):
    """NHL-style demo with regulation, overtime, and shootout."""

    regulation_period_seconds = 20 * 60
    regulation_periods = 3
    overtime_seconds = 5 * 60

    def _reset_internal(self, now_local: datetime) -> None:
        self._overtime_start: Optional[datetime] = None
        self._shootout_resolved = False
        self._final_label = "Final"
        # schedule first score with slower cadence for hockey
        self._schedule_next_score(self._start_time, minimum=45, maximum=120)

    def _build_snapshot(self, now_local: datetime) -> Optional[EnhancedGameSnapshot]:
        if now_local < self._start_time:
            seconds_to_start = int((self._start_time - now_local).total_seconds())
            return self._snapshot(
                state=GameState.PRE,
                period=0,
                seconds_to_start=seconds_to_start,
                display_clock="",
                period_name="Pre-game",
                is_overtime=False,
                is_shootout=False,
            )

        elapsed = int((now_local - self._start_time).total_seconds())
        regulation_total = self.regulation_periods * self.regulation_period_seconds

        if elapsed < regulation_total:
            self._maybe_award_points(now_local, choices=[1])
            period_index = elapsed // self.regulation_period_seconds
            period_number = period_index + 1
            remaining = self.regulation_period_seconds - (elapsed % self.regulation_period_seconds)
            timing = self._base_timing(
                period=period_number,
                display_clock=self._format_clock(remaining),
                is_overtime=False,
                is_shootout=False,
            )
            return EnhancedGameSnapshot(
                sport=self.sport,
                event_id=f"{self.sport.value}-demo",
                start_time_local=self._start_time,
                state=GameState.LIVE,
                home=self._home,
                away=self._away,
                timing=timing,
                seconds_to_start=-1,
                status_detail=f"P{period_number}",
            )

        # Regulation finished – decide on overtime/shootout/final.
        if self._home.score != self._away.score:
            # Regulation winner
            return self._final_snapshot("Final")

        # Overtime setup
        if self._overtime_start is None:
            self._overtime_start = self._start_time + timedelta(seconds=regulation_total)
            # faster scoring cadence in overtime
            self._schedule_next_score(now_local, minimum=15, maximum=45)

        if now_local < self._overtime_start + timedelta(seconds=self.overtime_seconds):
            self._maybe_award_points(now_local, choices=[1])
            if self._home.score != self._away.score:
                self._final_label = "Final/OT"
                return self._final_snapshot("Final/OT")

            ot_remaining = int(
                (self._overtime_start + timedelta(seconds=self.overtime_seconds) - now_local).total_seconds()
            )
            timing = self._base_timing(
                period=self.regulation_periods + 1,
                display_clock=self._format_clock(ot_remaining),
                is_overtime=True,
                is_shootout=False,
            )
            return EnhancedGameSnapshot(
                sport=self.sport,
                event_id=f"{self.sport.value}-demo",
                start_time_local=self._start_time,
                state=GameState.LIVE,
                home=self._home,
                away=self._away,
                timing=timing,
                seconds_to_start=-1,
                status_detail="OT",
            )

        # Shootout resolution
        if not self._shootout_resolved:
            winner = self._home if self.rng.random() < 0.5 else self._away
            winner.score += 1
            self._shootout_resolved = True
            self._final_label = "Final/SO"

        return self._final_snapshot("Final/SO")

    def _format_clock(self, seconds: int) -> str:
        seconds = max(0, seconds)
        minutes, secs = divmod(seconds, 60)
        return f"{minutes:02d}:{secs:02d}"

    def _base_timing(
        self,
        *,
        period: int,
        display_clock: str,
        is_overtime: bool,
        is_shootout: bool,
    ) -> GameTiming:
        return GameTiming(
            current_period=period,
            period_name="SO" if is_shootout else ("OT" if is_overtime and period > self.regulation_periods else f"P{period}"),
            period_max=self.regulation_periods,
            display_clock=display_clock,
            clock_running=True,
            is_intermission=False,
            is_overtime=is_overtime,
            is_shootout=is_shootout,
        )

    def _final_snapshot(self, label: str) -> EnhancedGameSnapshot:
        return self._snapshot(
            state=GameState.FINAL,
            period=self.regulation_periods,
            seconds_to_start=-1,
            display_clock="00:00",
            period_name=label,
            is_overtime="OT" in label,
            is_shootout="SO" in label,
        )

    def _snapshot(
        self,
        *,
        state: GameState,
        period: int,
        seconds_to_start: int,
        display_clock: str,
        period_name: str,
        is_overtime: bool,
        is_shootout: bool,
    ) -> EnhancedGameSnapshot:
        timing = GameTiming(
            current_period=period,
            period_name=period_name,
            period_max=self.regulation_periods,
            display_clock=display_clock,
            clock_running=state == GameState.LIVE,
            is_intermission=False,
            is_overtime=is_overtime,
            is_shootout=is_shootout,
        )
        return EnhancedGameSnapshot(
            sport=self.sport,
            event_id=f"{self.sport.value}-demo",
            start_time_local=self._start_time,
            state=state,
            home=self._home,
            away=self._away,
            timing=timing,
            seconds_to_start=seconds_to_start,
            status_detail=period_name,
        )


class GenericFallbackDemo(BaseSportDemo):
    """Simple ticker used when no dedicated simulator exists."""

    period_seconds = 8 * 60

    def _build_snapshot(self, now_local: datetime) -> Optional[EnhancedGameSnapshot]:
        if now_local < self._start_time:
            seconds_to_start = int((self._start_time - now_local).total_seconds())
            return self._make_snapshot(
                state=GameState.PRE,
                period=0,
                seconds_to_start=seconds_to_start,
                display_clock="",
                status="Demo",
            )

        elapsed = int((now_local - self._start_time).total_seconds())
        if elapsed >= 3 * self.period_seconds:
            return self._make_snapshot(
                state=GameState.FINAL,
                period=3,
                seconds_to_start=-1,
                display_clock="00:00",
                status="Final",
            )

        self._maybe_award_points(now_local, choices=[1, 2])
        remaining = self.period_seconds - (elapsed % self.period_seconds)
        clock = self._format_clock(remaining)
        period_number = 1 + elapsed // self.period_seconds
        return self._make_snapshot(
            state=GameState.LIVE,
            period=period_number,
            seconds_to_start=-1,
            display_clock=clock,
            status=f"Period {period_number}",
        )

    def _format_clock(self, seconds: int) -> str:
        seconds = max(0, seconds)
        minutes, secs = divmod(seconds, 60)
        return f"{minutes:02d}:{secs:02d}"

    def _make_snapshot(
        self,
        *,
        state: GameState,
        period: int,
        seconds_to_start: int,
        display_clock: str,
        status: str,
    ) -> EnhancedGameSnapshot:
        timing = GameTiming(
            current_period=period,
            period_name=status,
            period_max=3,
            display_clock=display_clock,
            clock_running=state == GameState.LIVE,
            is_intermission=False,
            is_overtime=False,
            is_shootout=False,
        )
        return EnhancedGameSnapshot(
            sport=self.sport,
            event_id=f"{self.sport.value}-demo",
            start_time_local=self._start_time,
            state=state,
            home=self._home,
            away=self._away,
            timing=timing,
            seconds_to_start=seconds_to_start,
            status_detail=status,
        )


SPORT_SIMULATOR_FACTORIES: Dict[SportType, type[BaseSportDemo]] = {
    SportType.WNBA: WNBADemoSimulator,
    SportType.NHL: NHLDemoSimulator,
}


class DemoSimulator:
    """Facade that coordinates sport-specific demo simulators."""

    def __init__(
        self,
        multi_cfg: MultiSportAppConfig,
        legacy_cfg: AppConfig,
        *,
        options: Optional[DemoOptions] = None,
    ) -> None:
        self.multi_cfg = multi_cfg
        self.legacy_cfg = legacy_cfg
        self.options = options or DemoOptions()
        self.rng = random.Random()
        now = datetime.now(legacy_cfg.tz)
        self.simulators: List[BaseSportDemo] = self._build_simulators(now)
        if not self.simulators:
            # fall back to highest priority legacy favorites as generic demo
            fallback = GenericFallbackDemo(
                sport=SportType.WNBA,
                tz=legacy_cfg.tz,
                favorites=legacy_cfg.favorites,
                rng=self.rng,
            )
            self.simulators = [fallback]
        self._current_index = 0
        self._last_switch = now

    def _build_simulators(self, now_local: datetime) -> List[BaseSportDemo]:
        order = self._determine_order()
        simulators: List[BaseSportDemo] = []
        for sport in order:
            favorites = self.multi_cfg.get_favorites_for_sport(sport)
            factory = SPORT_SIMULATOR_FACTORIES.get(sport, GenericFallbackDemo)
            simulator = factory(sport=sport, tz=self.multi_cfg.tz or self.legacy_cfg.tz, favorites=favorites, rng=self.rng)
            simulator.reset(now_local)
            simulators.append(simulator)
        return simulators

    def _determine_order(self) -> List[SportType]:
        if self.options.forced_sports:
            return [sport for sport in self.options.forced_sports]
        enabled = self.multi_cfg.get_enabled_sports()
        return enabled or [SportType.WNBA]

    def get_snapshot(self, now_local: datetime) -> Optional[GameSnapshot]:
        if not self.simulators:
            return None
        if self._should_rotate(now_local):
            self._advance_rotation(now_local)
        current = self.simulators[self._current_index]
        return current.get_snapshot(now_local)

    def _should_rotate(self, now_local: datetime) -> bool:
        if len(self.simulators) <= 1:
            return False
        if self.options.rotation_seconds <= 0:
            return False
        return (now_local - self._last_switch).total_seconds() >= self.options.rotation_seconds

    def _advance_rotation(self, now_local: datetime) -> None:
        self._current_index = (self._current_index + 1) % len(self.simulators)
        self.simulators[self._current_index].reset(now_local)
        self._last_switch = now_local


def parse_demo_options(
    *,
    rotation_seconds: Optional[int],
    forced_sports: Optional[Iterable[str]],
) -> DemoOptions:
    forced: Optional[List[SportType]] = None
    if forced_sports:
        forced = []
        for value in forced_sports:
            try:
                forced.append(SportType(value.strip()))
            except ValueError:
                continue
    seconds = rotation_seconds if rotation_seconds is not None else DEFAULT_ROTATION_SECONDS
    return DemoOptions(rotation_seconds=max(0, seconds), forced_sports=forced)
