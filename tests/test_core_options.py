"""Unit tests for RuntimeOptions."""

import unittest
import os
from unittest.mock import patch
from src.core.options import RuntimeOptions


class TestRuntimeOptions(unittest.TestCase):
    """Test cases for RuntimeOptions."""

    def test_default_values(self):
        """Test default option values."""
        options = RuntimeOptions()

        self.assertEqual(options.config_path, "config/favorites.json")
        self.assertFalse(options.force_simulation)
        self.assertFalse(options.run_once)
        self.assertFalse(options.demo_mode)
        self.assertEqual(options.demo_leagues, [])
        self.assertEqual(options.demo_rotation_seconds, 120)  # DEFAULT_ROTATION_SECONDS

    def test_from_args_basic(self):
        """Test creating options from command line arguments."""
        args = ["--sim", "--once"]
        options = RuntimeOptions.from_args(args)

        self.assertTrue(options.force_simulation)
        self.assertTrue(options.run_once)
        self.assertFalse(options.demo_mode)

    def test_from_args_demo_mode(self):
        """Test demo mode arguments."""
        args = ["--demo", "--demo-league", "nhl", "--demo-league", "nba", "--demo-rotation", "60"]
        options = RuntimeOptions.from_args(args)

        self.assertTrue(options.demo_mode)
        self.assertEqual(options.demo_leagues, ["nhl", "nba"])
        self.assertEqual(options.demo_rotation_seconds, 60)

    def test_from_args_config_path(self):
        """Test custom config path argument."""
        args = ["--config", "custom/config.json"]
        options = RuntimeOptions.from_args(args)

        self.assertEqual(options.config_path, "custom/config.json")

    @patch.dict(os.environ, {"DEMO_MODE": "true"})
    def test_is_demo_from_environment(self):
        """Test demo mode detection from environment."""
        options = RuntimeOptions()
        self.assertTrue(options.is_demo)

    @patch.dict(os.environ, {"DEMO_MODE": "false"})
    def test_is_demo_false_from_environment(self):
        """Test demo mode false from environment."""
        options = RuntimeOptions()
        options.demo_mode = False
        self.assertFalse(options.is_demo)

    @patch.dict(os.environ, {"SIMULATION_MODE": "true"})
    def test_is_simulation_from_environment(self):
        """Test simulation mode detection from environment."""
        options = RuntimeOptions()
        self.assertTrue(options.is_simulation)

    @patch.dict(os.environ, {"DEMO_LEAGUES": "wnba,mlb"})
    def test_demo_leagues_from_environment(self):
        """Test loading demo leagues from environment."""
        args = []
        options = RuntimeOptions.from_args(args)

        self.assertEqual(options.demo_leagues, ["wnba", "mlb"])

    @patch.dict(os.environ, {"DEMO_ROTATION_SECONDS": "30"})
    def test_demo_rotation_from_environment(self):
        """Test loading demo rotation from environment."""
        args = []
        options = RuntimeOptions.from_args(args)

        self.assertEqual(options.demo_rotation_seconds, 30)

    @patch.dict(os.environ, {"DEMO_ROTATION_SECONDS": "invalid"})
    def test_invalid_demo_rotation_from_environment(self):
        """Test handling invalid demo rotation from environment."""
        args = []
        options = RuntimeOptions.from_args(args)

        # Should fall back to default
        self.assertEqual(options.demo_rotation_seconds, 120)

    def test_args_override_environment(self):
        """Test that command line args override environment variables."""
        with patch.dict(os.environ, {"DEMO_LEAGUES": "nhl"}):
            args = ["--demo-league", "nba"]
            options = RuntimeOptions.from_args(args)

            self.assertEqual(options.demo_leagues, ["nba"])

    @patch.dict(os.environ, {
        "SUPABASE_URL": "https://test.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "test_key",
        "DEVICE_ID": "test_device"
    })
    def test_validate_success(self):
        """Test validation with required environment variables."""
        options = RuntimeOptions()
        options.validate()  # Should not raise

    @patch.dict(os.environ, {}, clear=True)
    def test_validate_missing_env_vars(self):
        """Test validation fails with missing environment variables."""
        options = RuntimeOptions()
        options.demo_mode = False  # Not in demo mode

        with self.assertRaises(ValueError) as context:
            options.validate()

        self.assertIn("Missing required environment variables", str(context.exception))

    @patch.dict(os.environ, {}, clear=True)
    def test_validate_demo_mode_no_env_required(self):
        """Test that demo mode doesn't require environment variables."""
        options = RuntimeOptions()
        options.demo_mode = True
        options.validate()  # Should not raise

    def test_validate_invalid_demo_leagues(self):
        """Test validation fails with invalid demo leagues."""
        options = RuntimeOptions()
        options.demo_mode = True  # Must be in demo mode to skip env var check
        options.demo_leagues = ["invalid_league", "nhl"]

        with self.assertRaises(ValueError) as context:
            options.validate()

        self.assertIn("Invalid demo leagues: invalid_league", str(context.exception))

    def test_validate_invalid_rotation_seconds(self):
        """Test validation fails with invalid rotation seconds."""
        options = RuntimeOptions()
        options.demo_mode = True  # Must be in demo mode to skip env var check
        options.demo_rotation_seconds = 0

        with self.assertRaises(ValueError) as context:
            options.validate()

        self.assertIn("Demo rotation seconds must be at least 1", str(context.exception))

    def test_str_representation(self):
        """Test string representation of options."""
        options = RuntimeOptions()
        options.demo_mode = True
        options.demo_leagues = ["nhl", "nba"]

        str_repr = str(options)

        self.assertIn("Runtime Options:", str_repr)
        self.assertIn("Config Path: config/favorites.json", str_repr)
        self.assertIn("Demo Mode: True", str_repr)
        self.assertIn("Demo Leagues: nhl, nba", str_repr)

    def test_str_representation_no_demo(self):
        """Test string representation without demo mode."""
        options = RuntimeOptions()
        options.demo_mode = False

        str_repr = str(options)

        self.assertIn("Demo Mode: False", str_repr)
        self.assertNotIn("Demo Leagues:", str_repr)
        self.assertNotIn("Demo Rotation:", str_repr)


if __name__ == '__main__':
    unittest.main()