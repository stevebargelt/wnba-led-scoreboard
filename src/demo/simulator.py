"""Demo simulator for league-based scoreboard system."""

from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Sequence
from zoneinfo import ZoneInfo

from src.config.supabase_config_loader import DeviceConfiguration, TeamInfo
from src.model.game import GameSnapshot, GameState, TeamSide
from src.model.sport_game import EnhancedGameSnapshot, GameTiming, SportTeam

DEFAULT_ROTATION_SECONDS = 120
DEFAULT_PREGAME_SECONDS = 10


@dataclass
class DemoOptions:
    """Runtime options for demo mode selection."""
    rotation_seconds: int = DEFAULT_ROTATION_SECONDS
    forced_leagues: Optional[List[str]] = None  # Changed from forced_sports


def parse_demo_options(
    forced_leagues: Optional[List[str]] = None,
    rotation_seconds: int = DEFAULT_ROTATION_SECONDS,
) -> DemoOptions:
    """Parse demo options from command line arguments."""
    return DemoOptions(
        rotation_seconds=rotation_seconds,
        forced_leagues=forced_leagues,
    )


def _fallback_identifier(name: str, default: str) -> str:
    if not name:
        return default
    cleaned = "".join(ch for ch in name.upper() if ch.isalpha())
    return (cleaned or default)[:3]


def _favorite_to_team(
    league_code: str,
    favorite: Optional[TeamInfo],
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
            league_code=league_code,
        )

    return SportTeam(
        id=favorite.team_id,
        name=favorite.name,
        abbr=favorite.abbreviation,
        score=0,
        league_code=league_code,
    )


class LeagueDemoSimulator:
    """Base class for league-specific demo simulators."""

    pregame_seconds = DEFAULT_PREGAME_SECONDS

    def __init__(
        self,
        league_code: str,
        tz: ZoneInfo,
        favorites: Sequence[TeamInfo],
        *,
        rng: Optional[random.Random] = None,
    ) -> None:
        self.league_code = league_code
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
        self._away = _favorite_to_team(self.league_code, away_fav, "Away", "demo-away", "AWY")
        self._home = _favorite_to_team(self.league_code, home_fav, "Home", "demo-home", "HOM")
        self._home.score = 0
        self._away.score = 0
        self._start_time = now_local + timedelta(seconds=self.pregame_seconds)
        self._next_score_time = self._start_time
        self._final_label = "Final"
        self._reset_internal(now_local)

    def _reset_internal(self, now_local: datetime) -> None:
        """Override in subclasses for league-specific initialization."""
        pass

    def _schedule_next_score(self, base_time: datetime, minimum: int = 30, maximum: int = 90) -> None:
        """Schedule the next scoring event."""
        delay = self.rng.randint(minimum, maximum)
        self._next_score_time = base_time + timedelta(seconds=delay)

    def _maybe_award_points(self, now_local: datetime, choices: List[int]) -> None:
        """Award points if it's time."""
        if now_local < self._next_score_time:
            return
        points = self.rng.choice(choices)
        team = self.rng.choice([self._home, self._away])
        team.score += points
        self._schedule_next_score(now_local)

    def get_snapshot(self, now_local: datetime) -> Optional[GameSnapshot]:
        """Get current game snapshot."""
        return self._build_snapshot(now_local)

    def _build_snapshot(self, now_local: datetime) -> Optional[EnhancedGameSnapshot]:
        """Build snapshot - override in subclasses."""
        raise NotImplementedError

    def _format_clock(self, seconds: int) -> str:
        seconds = max(0, seconds)
        minutes, secs = divmod(seconds, 60)
        return f"{minutes:02d}:{secs:02d}"


class WNBADemoSimulator(LeagueDemoSimulator):
    """WNBA-specific demo with 4 quarters."""

    period_seconds = 10 * 60  # 10-minute quarters
    period_count = 4

    def _reset_internal(self, now_local: datetime) -> None:
        self._schedule_next_score(self._start_time)

    def _build_snapshot(self, now_local: datetime) -> Optional[EnhancedGameSnapshot]:
        if now_local < self._start_time:
            seconds_to_start = int((self._start_time - now_local).total_seconds())
            return self._make_snapshot(
                state=GameState.PRE,
                period=0,
                seconds_to_start=seconds_to_start,
                display_clock="",
                period_name="Pre-game",
                is_overtime=False,
            )

        elapsed = int((now_local - self._start_time).total_seconds())
        total_game_seconds = self.period_count * self.period_seconds

        if elapsed >= total_game_seconds:
            return self._make_snapshot(
                state=GameState.FINAL,
                period=self.period_count,
                seconds_to_start=-1,
                display_clock="00:00",
                period_name=self._final_label,
                is_overtime=False,
            )

        self._maybe_award_points(now_local, choices=[1, 2, 3])

        period_index = elapsed // self.period_seconds
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
            league_code=self.league_code,  # Updated from sport
            event_id=f"{self.league_code}-demo",
            start_time_local=self._start_time,
            state=state,
            home=self._home,
            away=self._away,
            timing=timing,
            seconds_to_start=seconds_to_start,
            status_detail=period_name if state != GameState.FINAL else self._final_label,
        )


class NHLDemoSimulator(LeagueDemoSimulator):
    """NHL-specific demo with 3 periods."""

    period_seconds = 20 * 60  # 20-minute periods
    period_count = 3

    def _reset_internal(self, now_local: datetime) -> None:
        # Hockey scores less frequently
        self._schedule_next_score(self._start_time, minimum=45, maximum=120)

    def _build_snapshot(self, now_local: datetime) -> Optional[EnhancedGameSnapshot]:
        if now_local < self._start_time:
            seconds_to_start = int((self._start_time - now_local).total_seconds())
            return self._make_snapshot(
                state=GameState.PRE,
                period=0,
                seconds_to_start=seconds_to_start,
                display_clock="",
                period_name="Pre-game",
                is_overtime=False,
            )

        elapsed = int((now_local - self._start_time).total_seconds())
        total_game_seconds = self.period_count * self.period_seconds

        if elapsed >= total_game_seconds:
            return self._make_snapshot(
                state=GameState.FINAL,
                period=self.period_count,
                seconds_to_start=-1,
                display_clock="00:00",
                period_name=self._final_label,
                is_overtime=False,
            )

        self._maybe_award_points(now_local, choices=[1])  # Hockey only scores 1 goal at a time

        period_index = elapsed // self.period_seconds
        remaining = self.period_seconds - (elapsed % self.period_seconds)
        clock = self._format_clock(remaining)
        period_number = period_index + 1

        return self._make_snapshot(
            state=GameState.LIVE,
            period=period_number,
            seconds_to_start=-1,
            display_clock=clock,
            period_name=f"P{period_number}",
            is_overtime=False,
        )

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
            league_code=self.league_code,  # Updated from sport
            event_id=f"{self.league_code}-demo",
            start_time_local=self._start_time,
            state=state,
            home=self._home,
            away=self._away,
            timing=timing,
            seconds_to_start=seconds_to_start,
            status_detail=period_name if state != GameState.FINAL else self._final_label,
        )


class NBADemoSimulator(WNBADemoSimulator):
    """NBA demo - same as WNBA but with different league code."""

    def __init__(self, *args, **kwargs):
        # Override to use NBA league code
        super().__init__("nba", *args[1:], **kwargs)


class DemoSimulator:
    """Main demo simulator that rotates between leagues."""

    def __init__(
        self,
        cfg: DeviceConfiguration,
        options: Optional[DemoOptions] = None,
    ) -> None:
        self.cfg = cfg
        self.tz = cfg.tz or ZoneInfo(cfg.timezone)
        self.options = options or DemoOptions()

        # Create simulators for each enabled league
        self.simulators: Dict[str, LeagueDemoSimulator] = {}
        self.enabled_leagues: List[str] = []

        # Determine which leagues to simulate
        # If forced leagues are specified, only simulate those (but they must be enabled)
        if self.options.forced_leagues:
            leagues_to_simulate = [
                league for league in self.options.forced_leagues
                if league in cfg.enabled_leagues
            ]
            if not leagues_to_simulate:
                print(f"[warning] Forced leagues {self.options.forced_leagues} not in enabled leagues {cfg.enabled_leagues}")
        else:
            leagues_to_simulate = cfg.enabled_leagues

        for league_code in leagues_to_simulate:
            self.enabled_leagues.append(league_code)
            favorites = cfg.favorite_teams.get(league_code, [])

            if league_code == "wnba":
                self.simulators[league_code] = WNBADemoSimulator(
                    league_code, self.tz, favorites
                )
            elif league_code == "nhl":
                self.simulators[league_code] = NHLDemoSimulator(
                    league_code, self.tz, favorites
                )
            elif league_code == "nba":
                self.simulators[league_code] = NBADemoSimulator(
                    league_code, self.tz, favorites
                )

        self.current_league_index = 0
        self.last_rotation = datetime.now(self.tz)

        if not self.enabled_leagues:
            print("[warning] No leagues enabled for demo mode")

    def get_snapshot(self, now_local: datetime) -> Optional[GameSnapshot]:
        """Get current game snapshot, rotating between leagues."""
        if not self.enabled_leagues:
            return None

        # Check if it's time to rotate
        if len(self.enabled_leagues) > 1:
            elapsed = (now_local - self.last_rotation).total_seconds()
            if elapsed >= self.options.rotation_seconds:
                self.current_league_index = (self.current_league_index + 1) % len(self.enabled_leagues)
                self.last_rotation = now_local

                # Reset the new simulator
                current_league = self.enabled_leagues[self.current_league_index]
                if current_league in self.simulators:
                    self.simulators[current_league].reset(now_local)

        # Get snapshot from current league simulator
        current_league = self.enabled_leagues[self.current_league_index]
        if current_league in self.simulators:
            return self.simulators[current_league].get_snapshot(now_local)

        return None