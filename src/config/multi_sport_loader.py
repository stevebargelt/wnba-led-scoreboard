"""
Enhanced configuration loader with multi-sport support and backward compatibility.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Union
from zoneinfo import ZoneInfo

from src.config.types import AppConfig, FavoriteTeam, MatrixConfig, RefreshConfig, RenderConfig
from src.config.multi_sport_types import (
    MultiSportAppConfig, LegacyAppConfig, SportFavorites, SportPriorityConfig,
    detect_config_format, migrate_legacy_config_to_multi_sport, convert_multi_sport_to_legacy
)
from src.sports.base import SportType


def env_bool(key: str, default: bool) -> bool:
    """Parse boolean from environment variable."""
    v = os.getenv(key)
    if v is None:
        return default
    return v.lower() in {"1", "true", "yes", "on"}


def load_multi_sport_config(path: str) -> MultiSportAppConfig:
    """
    Load configuration with multi-sport support and automatic migration.
    
    This function can load both legacy and multi-sport configuration formats
    and automatically migrates legacy configs to the new format.
    """
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    
    config_format = detect_config_format(raw)
    
    if config_format == "legacy":
        print("[info] Detected legacy configuration format - migrating to multi-sport")
        legacy_config = _parse_legacy_config(raw)
        return migrate_legacy_config_to_multi_sport(legacy_config)
    elif config_format == "multi_sport":
        print("[info] Loading multi-sport configuration")
        return _parse_multi_sport_config(raw)
    else:
        print("[warn] Unknown configuration format - creating default multi-sport config")
        timezone = os.getenv("TIMEZONE", raw.get("timezone", "America/Chicago"))
        from src.config.multi_sport_types import create_default_multi_sport_config
        return create_default_multi_sport_config(timezone)


def load_legacy_config(path: str) -> AppConfig:
    """
    Load legacy configuration format for backward compatibility.
    
    This maintains the existing interface for code that hasn't been updated yet.
    """
    multi_sport_config = load_multi_sport_config(path)
    legacy_config = convert_multi_sport_to_legacy(multi_sport_config)
    
    # Convert to AppConfig format
    cfg = AppConfig(
        favorites=legacy_config.favorites,
        timezone=legacy_config.timezone,
        matrix=legacy_config.matrix,
        refresh=legacy_config.refresh,
        render=legacy_config.render,
    )
    cfg.tz = ZoneInfo(legacy_config.timezone)
    return cfg


def _parse_legacy_config(raw: Dict[str, Any]) -> LegacyAppConfig:
    """Parse legacy configuration format."""
    favorites = [FavoriteTeam(**t) for t in raw.get("favorites", [])]
    timezone = os.getenv("TIMEZONE", raw.get("timezone", "America/Chicago"))
    
    # Parse matrix configuration
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
    
    # Parse refresh configuration
    r = raw.get("refresh", {})
    refresh = RefreshConfig(
        pregame_sec=int(os.getenv("REFRESH_PREGAME_SEC", r.get("pregame_sec", 30))),
        ingame_sec=int(os.getenv("REFRESH_INGAME_SEC", r.get("ingame_sec", 5))),
        final_sec=int(os.getenv("REFRESH_FINAL_SEC", r.get("final_sec", 60))),
    )
    
    # Parse render configuration
    rend = raw.get("render", {})
    render = RenderConfig(
        live_layout=os.getenv("LIVE_LAYOUT", rend.get("live_layout", "stacked")),
        logo_variant=os.getenv("LOGO_VARIANT", rend.get("logo_variant", "mini")),
    )
    
    return LegacyAppConfig(
        favorites=favorites,
        timezone=timezone,
        matrix=matrix,
        refresh=refresh,
        render=render,
        tz=ZoneInfo(timezone),
    )


def _parse_multi_sport_config(raw: Dict[str, Any]) -> MultiSportAppConfig:
    """Parse multi-sport configuration format."""
    # Parse sports configurations
    sports = []
    for sport_data in raw.get("sports", []):
        sport_type = SportType(sport_data.get("sport"))
        
        # Parse favorite teams for this sport
        teams = [FavoriteTeam(**team) for team in sport_data.get("favorites", [])]
        
        sport_config = SportFavorites(
            sport=sport_type,
            enabled=sport_data.get("enabled", True),
            priority=sport_data.get("priority", 1),
            teams=teams,
        )
        sports.append(sport_config)
    
    # Parse sport priority configuration
    priority_config_data = raw.get("sport_priority", {})
    sport_priority = SportPriorityConfig(
        conflict_resolution=priority_config_data.get("conflict_resolution", "priority"),
        live_game_boost=priority_config_data.get("live_game_boost", True),
        favorite_team_boost=priority_config_data.get("favorite_team_boost", True),
        close_game_boost=priority_config_data.get("close_game_boost", True),
        playoff_boost=priority_config_data.get("playoff_boost", True),
        manual_override_duration_minutes=priority_config_data.get("manual_override_duration_minutes", 60),
        auto_clear_override_on_game_end=priority_config_data.get("auto_clear_override_on_game_end", True),
    )
    
    # Parse core system configuration (same as legacy)
    timezone = os.getenv("TIMEZONE", raw.get("timezone", "America/Chicago"))
    
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
    
    # Determine enabled sports
    enabled_sports = [sport_config.sport for sport_config in sports if sport_config.enabled]
    default_sport = enabled_sports[0] if enabled_sports else SportType.WNBA
    
    config = MultiSportAppConfig(
        sports=sports,
        sport_priority=sport_priority,
        timezone=timezone,
        matrix=matrix,
        refresh=refresh,
        render=render,
        enabled_sports=enabled_sports,
        default_sport=default_sport,
    )
    config.tz = ZoneInfo(timezone)
    return config


def save_multi_sport_config(config: MultiSportAppConfig, path: str) -> None:
    """Save multi-sport configuration to file."""
    config_data = {
        "sports": [
            {
                "sport": sport_config.sport.value,
                "enabled": sport_config.enabled,
                "priority": sport_config.priority,
                "favorites": [
                    {
                        "name": team.name,
                        "id": team.id,
                        "abbr": team.abbr,
                    }
                    for team in sport_config.teams
                ]
            }
            for sport_config in config.sports
        ],
        "sport_priority": {
            "conflict_resolution": config.sport_priority.conflict_resolution,
            "live_game_boost": config.sport_priority.live_game_boost,
            "favorite_team_boost": config.sport_priority.favorite_team_boost,
            "close_game_boost": config.sport_priority.close_game_boost,
            "playoff_boost": config.sport_priority.playoff_boost,
            "manual_override_duration_minutes": config.sport_priority.manual_override_duration_minutes,
            "auto_clear_override_on_game_end": config.sport_priority.auto_clear_override_on_game_end,
        },
        "timezone": config.timezone,
        "matrix": {
            "width": config.matrix.width,
            "height": config.matrix.height,
            "chain_length": config.matrix.chain_length,
            "parallel": config.matrix.parallel,
            "gpio_slowdown": config.matrix.gpio_slowdown,
            "hardware_mapping": config.matrix.hardware_mapping,
            "brightness": config.matrix.brightness,
            "pwm_bits": config.matrix.pwm_bits,
        },
        "refresh": {
            "pregame_sec": config.refresh.pregame_sec,
            "ingame_sec": config.refresh.ingame_sec,
            "final_sec": config.refresh.final_sec,
        },
        "render": {
            "live_layout": config.render.live_layout,
            "logo_variant": config.render.logo_variant,
        }
    }
    
    with open(path, "w", encoding="utf-8") as f:
        json.dump(config_data, f, indent=2, ensure_ascii=False)


# Environment variable overrides for multi-sport
def apply_environment_overrides_to_multi_sport_config(config: MultiSportAppConfig) -> MultiSportAppConfig:
    """Apply environment variable overrides to multi-sport configuration."""
    
    # Enable/disable sports via environment
    if os.getenv("ENABLE_WNBA"):
        _update_sport_enabled_status(config, SportType.WNBA, env_bool("ENABLE_WNBA", True))
    
    if os.getenv("ENABLE_NHL"):
        _update_sport_enabled_status(config, SportType.NHL, env_bool("ENABLE_NHL", False))
    
    # Sport priority overrides
    if os.getenv("SPORT_PRIORITIES"):
        try:
            # Format: "wnba,nhl,nba" - comma-separated in priority order
            priority_list = os.getenv("SPORT_PRIORITIES", "").split(",")
            sport_priorities = [SportType(sport.strip()) for sport in priority_list if sport.strip()]
            
            # Update sport priorities
            for i, sport in enumerate(sport_priorities):
                _update_sport_priority(config, sport, i + 1)
                
        except (ValueError, AttributeError) as e:
            print(f"[warn] Invalid SPORT_PRIORITIES format: {e}")
    
    # Priority rule overrides
    if os.getenv("LIVE_GAME_BOOST") is not None:
        config.sport_priority.live_game_boost = env_bool("LIVE_GAME_BOOST", True)
    
    if os.getenv("FAVORITE_TEAM_BOOST") is not None:
        config.sport_priority.favorite_team_boost = env_bool("FAVORITE_TEAM_BOOST", True)
    
    if os.getenv("CLOSE_GAME_BOOST") is not None:
        config.sport_priority.close_game_boost = env_bool("CLOSE_GAME_BOOST", True)
    
    if os.getenv("CONFLICT_RESOLUTION"):
        config.sport_priority.conflict_resolution = os.getenv("CONFLICT_RESOLUTION", "priority")
    
    return config


def _update_sport_enabled_status(config: MultiSportAppConfig, sport: SportType, enabled: bool) -> None:
    """Update enabled status for a specific sport."""
    for sport_config in config.sports:
        if sport_config.sport == sport:
            sport_config.enabled = enabled
            break
    else:
        # Sport not found, add it
        new_sport_config = SportFavorites(
            sport=sport,
            enabled=enabled,
            priority=len(config.sports) + 1,
            teams=[]
        )
        config.sports.append(new_sport_config)
    
    # Update enabled_sports list
    config.enabled_sports = config.get_enabled_sports()


def _update_sport_priority(config: MultiSportAppConfig, sport: SportType, priority: int) -> None:
    """Update priority for a specific sport."""
    for sport_config in config.sports:
        if sport_config.sport == sport:
            sport_config.priority = priority
            break


# Backward compatibility function
def load_config(path: str) -> AppConfig:
    """
    Legacy config loader for backward compatibility.
    
    Loads multi-sport config but returns legacy AppConfig format.
    This allows existing code to work unchanged during transition.
    """
    multi_sport_config = load_multi_sport_config(path)
    legacy_config = convert_multi_sport_to_legacy(multi_sport_config)
    
    # Convert to legacy AppConfig format
    cfg = AppConfig(
        favorites=legacy_config.favorites,
        timezone=legacy_config.timezone,
        matrix=legacy_config.matrix,
        refresh=legacy_config.refresh,
        render=legacy_config.render,
    )
    cfg.tz = ZoneInfo(legacy_config.timezone)
    return cfg


def _parse_legacy_config(raw: Dict[str, Any]) -> LegacyAppConfig:
    """Parse legacy configuration format."""
    favorites = [FavoriteTeam(**t) for t in raw.get("favorites", [])]
    timezone = os.getenv("TIMEZONE", raw.get("timezone", "America/Chicago"))
    
    # Matrix configuration (same parsing as original)
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
    
    # Refresh configuration (same parsing as original)
    r = raw.get("refresh", {})
    refresh = RefreshConfig(
        pregame_sec=int(os.getenv("REFRESH_PREGAME_SEC", r.get("pregame_sec", 30))),
        ingame_sec=int(os.getenv("REFRESH_INGAME_SEC", r.get("ingame_sec", 5))),
        final_sec=int(os.getenv("REFRESH_FINAL_SEC", r.get("final_sec", 60))),
    )
    
    # Render configuration (same parsing as original) 
    rend = raw.get("render", {})
    render = RenderConfig(
        live_layout=os.getenv("LIVE_LAYOUT", rend.get("live_layout", "stacked")),
        logo_variant=os.getenv("LOGO_VARIANT", rend.get("logo_variant", "mini")),
    )
    
    return LegacyAppConfig(
        favorites=favorites,
        timezone=timezone,
        matrix=matrix,
        refresh=refresh,
        render=render,
        tz=ZoneInfo(timezone),
    )