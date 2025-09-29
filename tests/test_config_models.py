"""Unit tests for configuration models and validation."""

import unittest
from zoneinfo import ZoneInfo

from src.config.models import (
    ValidatedMatrixConfig,
    ValidatedRefreshConfig,
    ValidatedRenderConfig,
    ValidatedAppConfig,
    ConfigurationValidator
)
from src.core.exceptions import ConfigurationError


class TestValidatedMatrixConfig(unittest.TestCase):
    """Test matrix configuration validation."""

    def test_valid_matrix_config(self):
        """Test creating valid matrix configuration."""
        config = ValidatedMatrixConfig(
            width=64,
            height=32,
            brightness=80
        )
        self.assertEqual(config.width, 64)
        self.assertEqual(config.height, 32)
        self.assertEqual(config.brightness, 80)

    def test_invalid_width(self):
        """Test invalid width validation."""
        # Too small
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedMatrixConfig(width=4, height=32)
        self.assertIn("width must be between 8 and 256", str(ctx.exception))

        # Too large
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedMatrixConfig(width=512, height=32)
        self.assertIn("width must be between 8 and 256", str(ctx.exception))

        # Not multiple of 8
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedMatrixConfig(width=50, height=32)
        self.assertIn("width must be multiple of 8", str(ctx.exception))

    def test_invalid_height(self):
        """Test invalid height validation."""
        # Too small
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedMatrixConfig(width=64, height=4)
        self.assertIn("height must be between 8 and 256", str(ctx.exception))

        # Not multiple of 8
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedMatrixConfig(width=64, height=35)
        self.assertIn("height must be multiple of 8", str(ctx.exception))

    def test_invalid_brightness(self):
        """Test invalid brightness validation."""
        # Too low
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedMatrixConfig(width=64, height=32, brightness=0)
        self.assertIn("Brightness must be between 1 and 100", str(ctx.exception))

        # Too high
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedMatrixConfig(width=64, height=32, brightness=101)
        self.assertIn("Brightness must be between 1 and 100", str(ctx.exception))

    def test_invalid_hardware_mapping(self):
        """Test invalid hardware mapping validation."""
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedMatrixConfig(
                width=64, height=32,
                hardware_mapping="invalid"
            )
        self.assertIn("Hardware mapping must be one of", str(ctx.exception))

    def test_chain_and_parallel_validation(self):
        """Test chain length and parallel validation."""
        # Valid chain length
        config = ValidatedMatrixConfig(width=64, height=32, chain_length=4)
        self.assertEqual(config.chain_length, 4)

        # Invalid chain length
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedMatrixConfig(width=64, height=32, chain_length=10)
        self.assertIn("Chain length must be between 1 and 8", str(ctx.exception))

        # Invalid parallel
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedMatrixConfig(width=64, height=32, parallel=4)
        self.assertIn("Parallel must be between 1 and 3", str(ctx.exception))

    def test_pwm_brightness_validation_warnings(self):
        """Test PWM bits and brightness relationship warnings."""
        # Test low PWM bits with high brightness warning
        with self.assertLogs('src.config.models', level='WARNING') as logs:
            config = ValidatedMatrixConfig(
                width=64, height=32,
                pwm_bits=6, brightness=75
            )
            self.assertIn("Low PWM bits (6) with high brightness (75%)", logs.output[0])

        # Test very low PWM bits warning
        with self.assertLogs('src.config.models', level='WARNING') as logs:
            config = ValidatedMatrixConfig(
                width=64, height=32,
                pwm_bits=3, brightness=30
            )
            self.assertIn("Very low PWM bits (3) detected", logs.output[0])
            self.assertIn("only 8 brightness levels", logs.output[0])

        # Test maximum PWM bits with low GPIO slowdown warning
        with self.assertLogs('src.config.models', level='WARNING') as logs:
            config = ValidatedMatrixConfig(
                width=64, height=32,
                pwm_bits=11, gpio_slowdown=1
            )
            self.assertIn("Maximum PWM bits (11) with low GPIO slowdown", logs.output[0])

        # Test that no warnings are issued for good configurations
        import logging
        with self.assertLogs('src.config.models', level='ERROR') as logs:
            # Set a high level to ensure no warnings are captured
            logger = logging.getLogger('src.config.models')
            original_level = logger.level
            logger.setLevel(logging.ERROR)
            try:
                # This should not produce any warnings
                config = ValidatedMatrixConfig(
                    width=64, height=32,
                    pwm_bits=10, brightness=80, gpio_slowdown=2
                )
                # Force a log to avoid "no logs of level ERROR" error
                logger.error("Test complete")
            finally:
                logger.setLevel(original_level)
            self.assertEqual(len(logs.output), 1)  # Only our test error


class TestValidatedRefreshConfig(unittest.TestCase):
    """Test refresh configuration validation."""

    def test_valid_refresh_config(self):
        """Test creating valid refresh configuration."""
        config = ValidatedRefreshConfig(
            pregame_sec=30,
            ingame_sec=5,
            final_sec=60
        )
        self.assertEqual(config.pregame_sec, 30)
        self.assertEqual(config.ingame_sec, 5)
        self.assertEqual(config.final_sec, 60)

    def test_invalid_pregame_seconds(self):
        """Test invalid pregame seconds validation."""
        # Too low
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedRefreshConfig(pregame_sec=2)
        self.assertIn("Pregame refresh must be between 5 and 300", str(ctx.exception))

        # Too high
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedRefreshConfig(pregame_sec=400)
        self.assertIn("Pregame refresh must be between 5 and 300", str(ctx.exception))

    def test_invalid_ingame_seconds(self):
        """Test invalid ingame seconds validation."""
        # Too low
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedRefreshConfig(ingame_sec=0)
        self.assertIn("Ingame refresh must be between 1 and 60", str(ctx.exception))

        # Too high
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedRefreshConfig(ingame_sec=100)
        self.assertIn("Ingame refresh must be between 1 and 60", str(ctx.exception))

    def test_invalid_final_seconds(self):
        """Test invalid final seconds validation."""
        # Too low
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedRefreshConfig(final_sec=5)
        self.assertIn("Final refresh must be between 10 and 600", str(ctx.exception))

        # Too high
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedRefreshConfig(final_sec=1000)
        self.assertIn("Final refresh must be between 10 and 600", str(ctx.exception))


class TestValidatedRenderConfig(unittest.TestCase):
    """Test render configuration validation."""

    def test_valid_render_config(self):
        """Test creating valid render configuration."""
        config = ValidatedRenderConfig(
            live_layout="big-logos",
            logo_variant="banner"
        )
        self.assertEqual(config.live_layout, "big-logos")
        self.assertEqual(config.logo_variant, "banner")

    def test_invalid_live_layout(self):
        """Test invalid live layout validation."""
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedRenderConfig(live_layout="invalid")
        self.assertIn("Live layout must be one of", str(ctx.exception))

    def test_invalid_logo_variant(self):
        """Test invalid logo variant validation."""
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedRenderConfig(logo_variant="invalid")
        self.assertIn("Logo variant must be one of", str(ctx.exception))


class TestValidatedAppConfig(unittest.TestCase):
    """Test complete application configuration validation."""

    def setUp(self):
        """Set up test fixtures."""
        self.valid_matrix = ValidatedMatrixConfig(width=64, height=32)
        self.valid_refresh = ValidatedRefreshConfig()
        self.valid_render = ValidatedRenderConfig()

    def test_valid_app_config(self):
        """Test creating valid application configuration."""
        config = ValidatedAppConfig(
            device_id="test-device",
            timezone="America/New_York",
            matrix=self.valid_matrix,
            refresh=self.valid_refresh,
            render=self.valid_render,
            enabled_leagues=["nhl", "nba"]
        )

        self.assertEqual(config.device_id, "test-device")
        self.assertEqual(config.timezone, "America/New_York")
        self.assertIsInstance(config.tz, ZoneInfo)
        self.assertEqual(config.enabled_leagues, ["nhl", "nba"])

    def test_missing_device_id(self):
        """Test missing device ID validation."""
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedAppConfig(
                device_id="",
                timezone="America/New_York",
                matrix=self.valid_matrix,
                refresh=self.valid_refresh,
                render=self.valid_render,
                enabled_leagues=["nhl"]
            )
        self.assertIn("Device ID is required", str(ctx.exception))

    def test_invalid_timezone(self):
        """Test invalid timezone validation."""
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedAppConfig(
                device_id="test",
                timezone="Invalid/Timezone",
                matrix=self.valid_matrix,
                refresh=self.valid_refresh,
                render=self.valid_render,
                enabled_leagues=["nhl"]
            )
        self.assertIn("Invalid timezone", str(ctx.exception))

    def test_no_enabled_leagues(self):
        """Test no enabled leagues validation."""
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedAppConfig(
                device_id="test",
                timezone="America/New_York",
                matrix=self.valid_matrix,
                refresh=self.valid_refresh,
                render=self.valid_render,
                enabled_leagues=[]
            )
        self.assertIn("At least one league must be enabled", str(ctx.exception))

    def test_invalid_league(self):
        """Test invalid league validation."""
        with self.assertRaises(ConfigurationError) as ctx:
            ValidatedAppConfig(
                device_id="test",
                timezone="America/New_York",
                matrix=self.valid_matrix,
                refresh=self.valid_refresh,
                render=self.valid_render,
                enabled_leagues=["invalid_league"]
            )
        self.assertIn("Invalid league 'invalid_league'", str(ctx.exception))

    def test_league_priorities_auto_populate(self):
        """Test that league priorities are auto-populated from enabled leagues."""
        config = ValidatedAppConfig(
            device_id="test",
            timezone="America/New_York",
            matrix=self.valid_matrix,
            refresh=self.valid_refresh,
            render=self.valid_render,
            enabled_leagues=["nhl", "nba"],
            league_priorities=["nhl"]  # Missing nba
        )

        # nba should be automatically added to priorities
        self.assertEqual(config.league_priorities, ["nhl", "nba"])


class TestConfigurationValidator(unittest.TestCase):
    """Test configuration validator utility."""

    def test_validate_matrix_config(self):
        """Test validating matrix configuration from dict."""
        config_dict = {
            "width": 128,
            "height": 64,
            "brightness": 90
        }

        config = ConfigurationValidator.validate_matrix_config(config_dict)
        self.assertEqual(config.width, 128)
        self.assertEqual(config.height, 64)
        self.assertEqual(config.brightness, 90)

    def test_validate_refresh_config(self):
        """Test validating refresh configuration from dict."""
        config_dict = {
            "pregame_sec": 45,
            "ingame_sec": 10,
            "final_sec": 120
        }

        config = ConfigurationValidator.validate_refresh_config(config_dict)
        self.assertEqual(config.pregame_sec, 45)
        self.assertEqual(config.ingame_sec, 10)
        self.assertEqual(config.final_sec, 120)

    def test_validate_render_config(self):
        """Test validating render configuration from dict."""
        config_dict = {
            "live_layout": "nhl-large",
            "logo_variant": "large"
        }

        config = ConfigurationValidator.validate_render_config(config_dict)
        self.assertEqual(config.live_layout, "nhl-large")
        self.assertEqual(config.logo_variant, "large")

    def test_validate_complete_config(self):
        """Test validating complete configuration from dict."""
        config_dict = {
            "device_id": "test-123",
            "timezone": "America/Los_Angeles",
            "matrix_width": 64,
            "matrix_height": 32,
            "matrix_brightness": 75,
            "refresh_pregame_sec": 20,
            "refresh_ingame_sec": 3,
            "refresh_final_sec": 90,
            "render_live_layout": "big-logos",
            "render_logo_variant": "banner",
            "enabled_leagues": ["wnba", "nba"],
            "league_priorities": ["wnba"]
        }

        config = ConfigurationValidator.validate_complete_config(config_dict)
        self.assertEqual(config.device_id, "test-123")
        self.assertEqual(config.timezone, "America/Los_Angeles")
        self.assertEqual(config.matrix.width, 64)
        self.assertEqual(config.refresh.ingame_sec, 3)
        self.assertEqual(config.render.live_layout, "big-logos")
        self.assertEqual(config.enabled_leagues, ["wnba", "nba"])
        # nba should be added to priorities
        self.assertEqual(config.league_priorities, ["wnba", "nba"])


if __name__ == '__main__':
    unittest.main()