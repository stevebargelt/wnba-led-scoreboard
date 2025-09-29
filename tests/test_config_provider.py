"""Unit tests for unified configuration provider."""

import unittest
from unittest.mock import Mock, patch
import os

from src.config.provider import (
    UnifiedConfigurationProvider,
    RuntimeConfigSource,
    EnvironmentConfigSource,
    SupabaseConfigSource,
    DefaultConfigSource,
    ConfigSource
)
from src.config.supabase_config_loader import DeviceConfiguration
from src.config.types import MatrixConfig, RefreshConfig, RenderConfig


class TestConfigSources(unittest.TestCase):
    """Test individual configuration sources."""

    def test_default_config_source(self):
        """Test default configuration source."""
        source = DefaultConfigSource()

        # Test getting default values
        self.assertEqual(source.get("matrix_width"), 64)
        self.assertEqual(source.get("matrix_height"), 32)
        self.assertEqual(source.get("timezone"), "America/New_York")
        self.assertEqual(source.priority, 10)

        # Test getting all defaults
        all_config = source.get_all()
        self.assertIn("matrix_width", all_config)
        self.assertIn("refresh_ingame_sec", all_config)

    def test_runtime_config_source(self):
        """Test runtime configuration source."""
        options = {
            "simulation_mode": True,
            "demo_mode": True,
            "custom_value": "test"
        }
        source = RuntimeConfigSource(options)

        # Test getting runtime values
        self.assertTrue(source.get("simulation_mode"))
        self.assertTrue(source.get("demo_mode"))
        self.assertEqual(source.get("custom_value"), "test")
        self.assertIsNone(source.get("nonexistent"))
        self.assertEqual(source.priority, 100)  # Highest priority

    @patch.dict(os.environ, {
        "SCOREBOARD_MATRIX_WIDTH": "128",
        "SCOREBOARD_SIMULATION_MODE": "true",
        "SCOREBOARD_BRIGHTNESS": "50",
        "SCOREBOARD_TEST_ARRAY": '["a", "b", "c"]'
    })
    def test_environment_config_source(self):
        """Test environment configuration source."""
        source = EnvironmentConfigSource()

        # Test parsing different types
        self.assertEqual(source.get("matrix_width"), 128)
        self.assertTrue(source.get("simulation_mode"))
        self.assertEqual(source.get("brightness"), 50)
        self.assertEqual(source.get("test_array"), ["a", "b", "c"])
        self.assertEqual(source.priority, 90)

    def test_environment_config_source_parsing(self):
        """Test environment variable parsing."""
        source = EnvironmentConfigSource()

        # Test boolean parsing
        self.assertTrue(source._parse_value("true"))
        self.assertTrue(source._parse_value("yes"))
        self.assertTrue(source._parse_value("1"))
        self.assertFalse(source._parse_value("false"))
        self.assertFalse(source._parse_value("no"))
        self.assertFalse(source._parse_value("0"))

        # Test number parsing
        self.assertEqual(source._parse_value("42"), 42)
        self.assertEqual(source._parse_value("3.14"), 3.14)

        # Test string parsing
        self.assertEqual(source._parse_value("hello"), "hello")

    def test_supabase_config_source(self):
        """Test Supabase configuration source."""
        # Create mock device configuration
        mock_config = Mock(spec=DeviceConfiguration)
        mock_config.device_id = "test-device"
        mock_config.timezone = "America/Los_Angeles"
        mock_config.enabled_leagues = ["nhl", "nba"]
        mock_config.league_priorities = ["nhl", "nba"]

        mock_config.matrix_config = Mock(spec=MatrixConfig)
        mock_config.matrix_config.width = 128
        mock_config.matrix_config.height = 64

        mock_config.refresh_config = Mock(spec=RefreshConfig)
        mock_config.refresh_config.ingame_sec = 3

        mock_config.render_config = Mock(spec=RenderConfig)
        mock_config.render_config.live_layout = "big-logos"

        source = SupabaseConfigSource(mock_config)

        # Test flattened values
        self.assertEqual(source.get("device_id"), "test-device")
        self.assertEqual(source.get("timezone"), "America/Los_Angeles")
        self.assertEqual(source.get("matrix_width"), 128)
        self.assertEqual(source.get("refresh_ingame_sec"), 3)
        self.assertEqual(source.get("render_live_layout"), "big-logos")
        self.assertEqual(source.priority, 50)

    def test_supabase_config_source_update(self):
        """Test updating Supabase configuration source."""
        source = SupabaseConfigSource()
        self.assertEqual(source.get("device_id"), None)

        # Update with new configuration
        mock_config = Mock(spec=DeviceConfiguration)
        mock_config.device_id = "updated-device"
        mock_config.timezone = "UTC"
        mock_config.enabled_leagues = []
        mock_config.league_priorities = []
        mock_config.matrix_config = None
        mock_config.refresh_config = None
        mock_config.render_config = None

        source.update(mock_config)
        self.assertEqual(source.get("device_id"), "updated-device")
        self.assertEqual(source.get("timezone"), "UTC")


class TestUnifiedConfigurationProvider(unittest.TestCase):
    """Test unified configuration provider."""

    def setUp(self):
        """Set up test fixtures."""
        self.default_source = DefaultConfigSource()
        self.runtime_source = RuntimeConfigSource({
            "simulation_mode": True,
            "custom_value": "runtime"
        })

    def test_empty_provider(self):
        """Test provider with no sources."""
        provider = UnifiedConfigurationProvider()

        self.assertIsNone(provider.get("any_key"))
        self.assertEqual(provider.get("any_key", "default"), "default")
        self.assertEqual(provider.get_all(), {})

    def test_single_source(self):
        """Test provider with single source."""
        provider = UnifiedConfigurationProvider([self.default_source])

        self.assertEqual(provider.get("matrix_width"), 64)
        self.assertEqual(provider.get("timezone"), "America/New_York")

    def test_source_precedence(self):
        """Test that higher priority sources override lower ones."""
        # Create sources with overlapping keys
        low_priority = Mock(spec=ConfigSource)
        low_priority.priority = 10
        low_priority.get_all.return_value = {"key1": "low", "key2": "low"}

        high_priority = Mock(spec=ConfigSource)
        high_priority.priority = 100
        high_priority.get_all.return_value = {"key1": "high", "key3": "high"}

        provider = UnifiedConfigurationProvider([low_priority, high_priority])

        # High priority should override low priority for key1
        self.assertEqual(provider.get("key1"), "high")
        # Low priority value should be used for key2
        self.assertEqual(provider.get("key2"), "low")
        # High priority value should be used for key3
        self.assertEqual(provider.get("key3"), "high")

    def test_add_remove_source(self):
        """Test adding and removing sources dynamically."""
        provider = UnifiedConfigurationProvider()

        # Initially empty
        self.assertIsNone(provider.get("matrix_width"))

        # Add default source
        provider.add_source(self.default_source)
        self.assertEqual(provider.get("matrix_width"), 64)

        # Add runtime source (higher priority)
        runtime = RuntimeConfigSource({"matrix_width": 128})
        provider.add_source(runtime)
        self.assertEqual(provider.get("matrix_width"), 128)  # Runtime overrides

        # Remove runtime source
        provider.remove_source(runtime)
        self.assertEqual(provider.get("matrix_width"), 64)  # Back to default

    def test_get_typed_configs(self):
        """Test getting typed configuration objects."""
        provider = UnifiedConfigurationProvider([self.default_source])

        # Get matrix config
        matrix = provider.get_matrix_config()
        self.assertEqual(matrix.width, 64)
        self.assertEqual(matrix.height, 32)
        self.assertEqual(matrix.brightness, 80)

        # Get refresh config
        refresh = provider.get_refresh_config()
        self.assertEqual(refresh.pregame_sec, 30)
        self.assertEqual(refresh.ingame_sec, 5)
        self.assertEqual(refresh.final_sec, 60)

        # Get render config
        render = provider.get_render_config()
        self.assertEqual(render.live_layout, "stacked")
        self.assertEqual(render.logo_variant, "mini")

    def test_get_nested(self):
        """Test getting nested configuration values."""
        source = Mock(spec=ConfigSource)
        source.priority = 50
        source.get_all.return_value = {
            "database": {
                "host": "localhost",
                "port": 5432,
                "credentials": {
                    "username": "user",
                    "password": "pass"
                }
            }
        }

        provider = UnifiedConfigurationProvider([source])

        # Test nested access
        self.assertEqual(provider.get_nested("database.host"), "localhost")
        self.assertEqual(provider.get_nested("database.port"), 5432)
        self.assertEqual(provider.get_nested("database.credentials.username"), "user")

        # Test missing nested keys
        self.assertIsNone(provider.get_nested("database.missing"))
        self.assertEqual(provider.get_nested("database.missing", "default"), "default")

    def test_complete_configuration_precedence(self):
        """Test complete configuration with all sources and precedence."""
        # Default source (priority 10)
        default = DefaultConfigSource()

        # Supabase source (priority 50)
        mock_config = Mock(spec=DeviceConfiguration)
        mock_config.device_id = "device-123"
        mock_config.timezone = "America/Chicago"
        mock_config.enabled_leagues = ["nhl"]
        mock_config.league_priorities = ["nhl"]
        mock_config.matrix_config = Mock(width=128, height=64)
        mock_config.refresh_config = None
        mock_config.render_config = None
        supabase = SupabaseConfigSource(mock_config)

        # Environment source (priority 90)
        with patch.dict(os.environ, {"SCOREBOARD_MATRIX_WIDTH": "256"}):
            env = EnvironmentConfigSource()

            # Runtime source (priority 100)
            runtime = RuntimeConfigSource({"simulation_mode": True})

            provider = UnifiedConfigurationProvider([default, supabase, env, runtime])

            # Runtime overrides all
            self.assertTrue(provider.get("simulation_mode"))

            # Environment overrides Supabase and default
            self.assertEqual(provider.get("matrix_width"), 256)

            # Supabase overrides default
            self.assertEqual(provider.get("timezone"), "America/Chicago")

            # Default is used when no override exists
            self.assertEqual(provider.get("refresh_ingame_sec"), 5)


if __name__ == '__main__':
    unittest.main()