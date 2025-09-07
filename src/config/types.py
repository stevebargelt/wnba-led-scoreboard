from __future__ import annotations

from dataclasses import dataclass, field
from zoneinfo import ZoneInfo
from typing import List, Optional


@dataclass
class FavoriteTeam:
    name: str
    id: Optional[str] = None
    abbr: Optional[str] = None


@dataclass
class MatrixConfig:
    width: int
    height: int
    chain_length: int = 1
    parallel: int = 1
    gpio_slowdown: int = 2
    hardware_mapping: str = "adafruit-hat"
    brightness: int = 80
    pwm_bits: int = 11


@dataclass
class RefreshConfig:
    pregame_sec: int = 30
    ingame_sec: int = 5
    final_sec: int = 60


@dataclass
class RenderConfig:
    live_layout: str = "stacked"  # "stacked" or "big-logos"
    logo_variant: str = "mini"     # "mini" or "banner"


@dataclass
class AppConfig:
    favorites: List[FavoriteTeam]
    timezone: str
    matrix: MatrixConfig
    refresh: RefreshConfig
    render: RenderConfig = field(default_factory=RenderConfig)
    tz: Optional[ZoneInfo] = None
