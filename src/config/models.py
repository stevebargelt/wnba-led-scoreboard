"""
Configuration models with validation.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Union
from zoneinfo import ZoneInfo

from src.core.exceptions import ConfigurationError
from src.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class ValidatedMatrixConfig:
    """Matrix configuration with validation."""

    width: int
    height: int
    chain_length: int = 1
    parallel: int = 1
    gpio_slowdown: int = 2
    hardware_mapping: str = "adafruit-hat"
    brightness: int = 80
    pwm_bits: int = 11

    def __post_init__(self):
        """Validate configuration after initialization."""
        # Validate width
        if not 8 <= self.width <= 256:
            raise ConfigurationError(f"Matrix width must be between 8 and 256, got {self.width}")
        if self.width % 8 != 0:
            raise ConfigurationError(f"Matrix width must be multiple of 8, got {self.width}")

        # Validate height
        if not 8 <= self.height <= 256:
            raise ConfigurationError(f"Matrix height must be between 8 and 256, got {self.height}")
        if self.height % 8 != 0:
            raise ConfigurationError(f"Matrix height must be multiple of 8, got {self.height}")

        # Validate brightness
        if not 1 <= self.brightness <= 100:
            raise ConfigurationError(f"Brightness must be between 1 and 100, got {self.brightness}")

        # Validate chain length
        if not 1 <= self.chain_length <= 8:
            raise ConfigurationError(f"Chain length must be between 1 and 8, got {self.chain_length}")

        # Validate parallel
        if not 1 <= self.parallel <= 3:
            raise ConfigurationError(f"Parallel must be between 1 and 3, got {self.parallel}")

        # Validate GPIO slowdown
        if not 0 <= self.gpio_slowdown <= 5:
            raise ConfigurationError(f"GPIO slowdown must be between 0 and 5, got {self.gpio_slowdown}")

        # Validate PWM bits
        if not 1 <= self.pwm_bits <= 11:
            raise ConfigurationError(f"PWM bits must be between 1 and 11, got {self.pwm_bits}")

        # Validate hardware mapping
        valid_mappings = ["regular", "adafruit-hat", "adafruit-hat-pwm", "compute-module"]
        if self.hardware_mapping not in valid_mappings:
            raise ConfigurationError(
                f"Hardware mapping must be one of {valid_mappings}, got {self.hardware_mapping}"
            )

        # Validate PWM bits and brightness relationship
        # Lower PWM bits reduce brightness resolution, which can cause flickering at high brightness
        if self.pwm_bits < 8 and self.brightness > 50:
            logger.warning(
                f"Low PWM bits ({self.pwm_bits}) with high brightness ({self.brightness}%) "
                "may cause visible flickering. Consider increasing PWM bits or reducing brightness."
            )

        # Additional warning for very low PWM bits
        if self.pwm_bits <= 4:
            logger.warning(
                f"Very low PWM bits ({self.pwm_bits}) detected. "
                f"This will result in only {2**self.pwm_bits} brightness levels. "
                "Consider using at least 8 PWM bits for smooth brightness control."
            )

        # Warn about performance impact of maximum PWM bits
        if self.pwm_bits == 11 and self.gpio_slowdown < 2:
            logger.warning(
                "Maximum PWM bits (11) with low GPIO slowdown may cause performance issues. "
                "Consider reducing PWM bits to 10 or increasing GPIO slowdown if you experience flicker."
            )


@dataclass
class ValidatedRefreshConfig:
    """Refresh configuration with validation."""

    pregame_sec: int = 30
    ingame_sec: int = 5
    final_sec: int = 60

    def __post_init__(self):
        """Validate configuration after initialization."""
        # Validate pregame seconds
        if not 5 <= self.pregame_sec <= 300:
            raise ConfigurationError(
                f"Pregame refresh must be between 5 and 300 seconds, got {self.pregame_sec}"
            )

        # Validate ingame seconds
        if not 1 <= self.ingame_sec <= 60:
            raise ConfigurationError(
                f"Ingame refresh must be between 1 and 60 seconds, got {self.ingame_sec}"
            )

        # Validate final seconds
        if not 10 <= self.final_sec <= 600:
            raise ConfigurationError(
                f"Final refresh must be between 10 and 600 seconds, got {self.final_sec}"
            )


@dataclass
class ValidatedRenderConfig:
    """Render configuration with validation."""

    live_layout: str = "stacked"
    logo_variant: str = "mini"

    def __post_init__(self):
        """Validate configuration after initialization."""
        # Validate live layout
        valid_layouts = ["stacked", "big-logos", "nhl-large"]
        if self.live_layout not in valid_layouts:
            raise ConfigurationError(
                f"Live layout must be one of {valid_layouts}, got {self.live_layout}"
            )

        # Validate logo variant
        valid_variants = ["mini", "banner", "large"]
        if self.logo_variant not in valid_variants:
            raise ConfigurationError(
                f"Logo variant must be one of {valid_variants}, got {self.logo_variant}"
            )


@dataclass
class ValidatedAppConfig:
    """Complete application configuration with validation."""

    device_id: str
    timezone: str
    matrix: ValidatedMatrixConfig
    refresh: ValidatedRefreshConfig
    render: ValidatedRenderConfig
    enabled_leagues: List[str] = field(default_factory=list)
    league_priorities: List[str] = field(default_factory=list)
    tz: Optional[ZoneInfo] = None

    def __post_init__(self):
        """Validate configuration after initialization."""
        # Validate device ID
        if not self.device_id:
            raise ConfigurationError("Device ID is required")

        # Validate timezone
        try:
            self.tz = ZoneInfo(self.timezone)
        except Exception as e:
            raise ConfigurationError(f"Invalid timezone '{self.timezone}': {e}")

        # Validate leagues
        if not self.enabled_leagues:
            raise ConfigurationError("At least one league must be enabled")

        valid_leagues = ["nhl", "nba", "wnba", "mlb", "nfl", "mls"]
        for league in self.enabled_leagues:
            if league not in valid_leagues:
                raise ConfigurationError(f"Invalid league '{league}', must be one of {valid_leagues}")

        # Ensure league priorities includes all enabled leagues
        for league in self.enabled_leagues:
            if league not in self.league_priorities:
                self.league_priorities.append(league)


class ConfigurationValidator:
    """Validator for configuration values."""

    @staticmethod
    def validate_matrix_config(config: dict) -> ValidatedMatrixConfig:
        """
        Validate and create matrix configuration.

        Args:
            config: Configuration dictionary

        Returns:
            Validated matrix configuration

        Raises:
            ConfigurationError: If validation fails
        """
        try:
            return ValidatedMatrixConfig(
                width=config.get("width", 64),
                height=config.get("height", 32),
                chain_length=config.get("chain_length", 1),
                parallel=config.get("parallel", 1),
                gpio_slowdown=config.get("gpio_slowdown", 2),
                hardware_mapping=config.get("hardware_mapping", "adafruit-hat"),
                brightness=config.get("brightness", 80),
                pwm_bits=config.get("pwm_bits", 11),
            )
        except TypeError as e:
            raise ConfigurationError(f"Invalid matrix configuration: {e}")

    @staticmethod
    def validate_refresh_config(config: dict) -> ValidatedRefreshConfig:
        """
        Validate and create refresh configuration.

        Args:
            config: Configuration dictionary

        Returns:
            Validated refresh configuration

        Raises:
            ConfigurationError: If validation fails
        """
        try:
            return ValidatedRefreshConfig(
                pregame_sec=config.get("pregame_sec", 30),
                ingame_sec=config.get("ingame_sec", 5),
                final_sec=config.get("final_sec", 60),
            )
        except TypeError as e:
            raise ConfigurationError(f"Invalid refresh configuration: {e}")

    @staticmethod
    def validate_render_config(config: dict) -> ValidatedRenderConfig:
        """
        Validate and create render configuration.

        Args:
            config: Configuration dictionary

        Returns:
            Validated render configuration

        Raises:
            ConfigurationError: If validation fails
        """
        try:
            return ValidatedRenderConfig(
                live_layout=config.get("live_layout", "stacked"),
                logo_variant=config.get("logo_variant", "mini"),
            )
        except TypeError as e:
            raise ConfigurationError(f"Invalid render configuration: {e}")

    @staticmethod
    def validate_complete_config(config: dict) -> ValidatedAppConfig:
        """
        Validate complete application configuration.

        Args:
            config: Configuration dictionary

        Returns:
            Validated application configuration

        Raises:
            ConfigurationError: If validation fails
        """
        # Validate sub-configurations
        matrix_config = ConfigurationValidator.validate_matrix_config(
            {k.replace("matrix_", ""): v for k, v in config.items() if k.startswith("matrix_")}
        )
        refresh_config = ConfigurationValidator.validate_refresh_config(
            {k.replace("refresh_", ""): v for k, v in config.items() if k.startswith("refresh_")}
        )
        render_config = ConfigurationValidator.validate_render_config(
            {k.replace("render_", ""): v for k, v in config.items() if k.startswith("render_")}
        )

        # Create complete config
        return ValidatedAppConfig(
            device_id=config.get("device_id", ""),
            timezone=config.get("timezone", "America/New_York"),
            matrix=matrix_config,
            refresh=refresh_config,
            render=render_config,
            enabled_leagues=config.get("enabled_leagues", []),
            league_priorities=config.get("league_priorities", []),
        )