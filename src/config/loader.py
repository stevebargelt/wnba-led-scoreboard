from __future__ import annotations

import json
import os
from typing import Any
from zoneinfo import ZoneInfo

from .types import AppConfig, FavoriteTeam, MatrixConfig, RefreshConfig, RenderConfig


def env_bool(key: str, default: bool) -> bool:
    v = os.getenv(key)
    if v is None:
        return default
    return v.lower() in {"1", "true", "yes", "on"}


def load_config(path: str) -> AppConfig:
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    favorites = [FavoriteTeam(**t) for t in raw.get("favorites", [])]
    tzname = os.getenv("TIMEZONE", raw.get("timezone", "America/Chicago"))

    m = raw.get("matrix", {})
    matrix = MatrixConfig(
        width=int(os.getenv("MATRIX_WIDTH", m.get("width", 64))),
        height=int(os.getenv("MATRIX_HEIGHT", m.get("height", 32))),
        chain_length=int(os.getenv("MATRIX_CHAIN_LENGTH", m.get("chain_length", 1))),
        parallel=int(os.getenv("MATRIX_PARALLEL", m.get("parallel", 1))),
        gpio_slowdown=int(os.getenv("MATRIX_GPIO_SLOWDOWN", m.get("gpio_slowdown", 2))),
        hardware_mapping=os.getenv("MATRIX_HARDWARE_MAPPING", m.get("hardware_mapping", "adafruit-hat")),
        brightness=int(os.getenv("MATRIX_BRIGHTNESS", m.get("brightness", 80))),
        pwm_bits=int(os.getenv("MATRIX_PWM_BITS", m.get("pwm_bits", 11))),
    )

    r = raw.get("refresh", {})
    refresh = RefreshConfig(
        pregame_sec=int(os.getenv("REFRESH_PREGAME_SEC", r.get("pregame_sec", 30))),
        ingame_sec=int(os.getenv("REFRESH_INGAME_SEC", r.get("ingame_sec", 5))),
        final_sec=int(os.getenv("REFRESH_FINAL_SEC", r.get("final_sec", 60))),
    )

    rend = raw.get("render", {})
    render = RenderConfig(
        live_layout=os.getenv("LIVE_LAYOUT", rend.get("live_layout", "stacked")),
        logo_variant=os.getenv("LOGO_VARIANT", rend.get("logo_variant", "mini")),
    )

    cfg = AppConfig(
        favorites=favorites,
        timezone=tzname,
        matrix=matrix,
        refresh=refresh,
        render=render,
    )
    cfg.tz = ZoneInfo(tzname)
    return cfg
