"""
Unified configuration provider with validation and precedence.
"""

from typing import Dict, List, Optional, Any, Union
from abc import ABC, abstractmethod
from dataclasses import asdict
import os
import json
from pathlib import Path

from src.core.logging import get_logger
from src.config.types import MatrixConfig, RefreshConfig, RenderConfig
from src.config.supabase_config_loader import DeviceConfiguration


logger = get_logger(__name__)


class ConfigSource(ABC):
    """Abstract base class for configuration sources."""

    @abstractmethod
    def get(self, key: str, default=None) -> Any:
        """Get configuration value by key."""
        pass

    @abstractmethod
    def get_all(self) -> Dict[str, Any]:
        """Get all configuration values."""
        pass

    @property
    @abstractmethod
    def priority(self) -> int:
        """Priority of this source (higher = more precedence)."""
        pass


class EnvironmentConfigSource(ConfigSource):
    """Configuration source from environment variables."""

    def __init__(self, prefix: str = "SCOREBOARD_"):
        self.prefix = prefix
        self._cache = self._load_env_vars()

    def _load_env_vars(self) -> Dict[str, Any]:
        """Load and parse environment variables."""
        config = {}
        for key, value in os.environ.items():
            if key.startswith(self.prefix):
                clean_key = key[len(self.prefix):].lower()
                config[clean_key] = self._parse_value(value)
        return config

    def _parse_value(self, value: str) -> Any:
        """Parse environment variable value."""
        # Try to parse as JSON first (for arrays/objects)
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            pass

        # Try to parse as boolean
        if value.lower() in ('true', 'yes', '1'):
            return True
        if value.lower() in ('false', 'no', '0'):
            return False

        # Try to parse as number
        try:
            if '.' in value:
                return float(value)
            return int(value)
        except ValueError:
            return value

    def get(self, key: str, default=None) -> Any:
        """Get configuration value from environment."""
        return self._cache.get(key.lower(), default)

    def get_all(self) -> Dict[str, Any]:
        """Get all environment configurations."""
        return self._cache.copy()

    @property
    def priority(self) -> int:
        return 90  # High priority


class RuntimeConfigSource(ConfigSource):
    """Configuration source from runtime arguments."""

    def __init__(self, options: Optional[Dict[str, Any]] = None):
        self.options = options or {}

    def get(self, key: str, default=None) -> Any:
        """Get configuration value from runtime options."""
        return self.options.get(key, default)

    def get_all(self) -> Dict[str, Any]:
        """Get all runtime configurations."""
        return self.options.copy()

    @property
    def priority(self) -> int:
        return 100  # Highest priority


class SupabaseConfigSource(ConfigSource):
    """Configuration source from Supabase database."""

    def __init__(self, device_config: Optional[DeviceConfiguration] = None):
        self.device_config = device_config
        self._cache = self._flatten_config() if device_config else {}

    def _flatten_config(self) -> Dict[str, Any]:
        """Flatten device configuration to key-value pairs."""
        if not self.device_config:
            return {}

        flat = {}

        # Define expected attributes for each config type
        matrix_attrs = ['width', 'height', 'chain_length', 'parallel',
                       'gpio_slowdown', 'hardware_mapping', 'brightness', 'pwm_bits']
        refresh_attrs = ['pregame_sec', 'ingame_sec', 'final_sec']
        render_attrs = ['live_layout', 'logo_variant']

        # Flatten matrix config
        if self.device_config.matrix_config:
            flat.update(self._flatten_object(
                self.device_config.matrix_config,
                'matrix',
                matrix_attrs
            ))

        # Flatten refresh config
        if self.device_config.refresh_config:
            flat.update(self._flatten_object(
                self.device_config.refresh_config,
                'refresh',
                refresh_attrs
            ))

        # Flatten render config
        if self.device_config.render_config:
            flat.update(self._flatten_object(
                self.device_config.render_config,
                'render',
                render_attrs
            ))

        # Other configs
        flat["device_id"] = self.device_config.device_id
        flat["timezone"] = self.device_config.timezone
        flat["enabled_leagues"] = self.device_config.enabled_leagues
        flat["league_priorities"] = self.device_config.league_priorities

        return flat

    def _flatten_object(self, obj: Any, prefix: str, expected_attrs: List[str]) -> Dict[str, Any]:
        """
        Flatten an object's attributes with a prefix.

        Handles both dataclasses and regular objects/mocks gracefully.

        Args:
            obj: Object to flatten
            prefix: Prefix for keys (e.g., 'matrix', 'refresh')
            expected_attrs: List of expected attribute names

        Returns:
            Dictionary with flattened attributes
        """
        result = {}

        # Check if this is a dataclass
        if self._is_dataclass(obj):
            # Use asdict for dataclasses
            for key, value in asdict(obj).items():
                result[f"{prefix}_{key}"] = value
        else:
            # For regular objects/mocks, use getattr for expected attributes
            for attr in expected_attrs:
                if hasattr(obj, attr):
                    result[f"{prefix}_{attr}"] = getattr(obj, attr)

        return result

    def _is_dataclass(self, obj: Any) -> bool:
        """
        Check if an object is a dataclass instance.

        Args:
            obj: Object to check

        Returns:
            True if object is a dataclass, False otherwise
        """
        # Import dataclasses to use is_dataclass function
        from dataclasses import is_dataclass

        # Use the official is_dataclass check which properly validates
        # both the instance and its class
        try:
            return is_dataclass(obj) and not isinstance(obj, type)
        except Exception:
            # If there's any issue, it's not a dataclass we can work with
            return False

    def get(self, key: str, default=None) -> Any:
        """Get configuration value from Supabase."""
        return self._cache.get(key, default)

    def get_all(self) -> Dict[str, Any]:
        """Get all Supabase configurations."""
        return self._cache.copy()

    @property
    def priority(self) -> int:
        return 50  # Medium priority

    def update(self, device_config: DeviceConfiguration):
        """Update with new device configuration."""
        self.device_config = device_config
        self._cache = self._flatten_config()


class DefaultConfigSource(ConfigSource):
    """Configuration source with default values."""

    def __init__(self):
        self.defaults = {
            # Matrix defaults
            "matrix_width": 64,
            "matrix_height": 32,
            "matrix_brightness": 80,
            "matrix_chain_length": 1,
            "matrix_parallel": 1,
            "matrix_gpio_slowdown": 2,
            "matrix_hardware_mapping": "adafruit-hat",
            "matrix_pwm_bits": 11,

            # Refresh defaults
            "refresh_pregame_sec": 30,
            "refresh_ingame_sec": 5,
            "refresh_final_sec": 60,

            # Render defaults
            "render_live_layout": "stacked",
            "render_logo_variant": "mini",

            # Other defaults
            "timezone": "America/New_York",
            "simulation_mode": False,
            "demo_mode": False,
        }

    def get(self, key: str, default=None) -> Any:
        """Get default configuration value."""
        return self.defaults.get(key, default)

    def get_all(self) -> Dict[str, Any]:
        """Get all default configurations."""
        return self.defaults.copy()

    @property
    def priority(self) -> int:
        return 10  # Lowest priority


class UnifiedConfigurationProvider:
    """
    Unified configuration provider that merges multiple sources.

    Configuration precedence (highest to lowest):
    1. Runtime arguments (priority 100)
    2. Environment variables (priority 90)
    3. Supabase database (priority 50)
    4. Default values (priority 10)
    """

    def __init__(self, sources: Optional[List[ConfigSource]] = None):
        """
        Initialize the configuration provider.

        Args:
            sources: List of configuration sources
        """
        self.sources = sources or []
        self._cache: Dict[str, Any] = {}
        self._rebuild_cache()

    def add_source(self, source: ConfigSource):
        """Add a configuration source."""
        self.sources.append(source)
        self._rebuild_cache()

    def remove_source(self, source: ConfigSource):
        """Remove a configuration source."""
        if source in self.sources:
            self.sources.remove(source)
            self._rebuild_cache()

    def _rebuild_cache(self):
        """Rebuild the merged configuration cache."""
        self._cache.clear()

        # Sort sources by priority (lowest first, so higher priority overwrites)
        sorted_sources = sorted(self.sources, key=lambda s: s.priority)

        # Merge configurations
        for source in sorted_sources:
            self._cache.update(source.get_all())

        logger.debug(f"Rebuilt configuration cache with {len(self._cache)} keys")

    def get(self, key: str, default=None) -> Any:
        """
        Get configuration value by key.

        Args:
            key: Configuration key
            default: Default value if key not found

        Returns:
            Configuration value
        """
        return self._cache.get(key, default)

    def get_nested(self, path: str, default=None) -> Any:
        """
        Get nested configuration value by dot-separated path.

        Args:
            path: Dot-separated path (e.g., "matrix.width")
            default: Default value if path not found

        Returns:
            Configuration value
        """
        keys = path.split('.')
        value = self._cache

        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
                if value is None:
                    return default
            else:
                return default

        return value

    def get_all(self) -> Dict[str, Any]:
        """Get all merged configuration values."""
        return self._cache.copy()

    def get_matrix_config(self) -> MatrixConfig:
        """Get matrix configuration."""
        return MatrixConfig(
            width=self.get("matrix_width", 64),
            height=self.get("matrix_height", 32),
            chain_length=self.get("matrix_chain_length", 1),
            parallel=self.get("matrix_parallel", 1),
            gpio_slowdown=self.get("matrix_gpio_slowdown", 2),
            hardware_mapping=self.get("matrix_hardware_mapping", "adafruit-hat"),
            brightness=self.get("matrix_brightness", 80),
            pwm_bits=self.get("matrix_pwm_bits", 11),
        )

    def get_refresh_config(self) -> RefreshConfig:
        """Get refresh configuration."""
        return RefreshConfig(
            pregame_sec=self.get("refresh_pregame_sec", 30),
            ingame_sec=self.get("refresh_ingame_sec", 5),
            final_sec=self.get("refresh_final_sec", 60),
        )

    def get_render_config(self) -> RenderConfig:
        """Get render configuration."""
        return RenderConfig(
            live_layout=self.get("render_live_layout", "stacked"),
            logo_variant=self.get("render_logo_variant", "mini"),
        )

    def reload(self):
        """Reload configuration from all sources."""
        for source in self.sources:
            if hasattr(source, 'reload'):
                source.reload()
        self._rebuild_cache()
        logger.info("Configuration reloaded from all sources")