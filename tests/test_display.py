"""Unit tests for display layer implementations."""

import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch, PropertyMock
import tempfile
import shutil

from PIL import Image, ImageDraw

from src.display import BaseDisplay, MatrixDisplay, SimulatorDisplay, MockDisplay
from src.display.base import DisplayConfig
from src.config.supabase_config_loader import DeviceConfiguration
from src.model.game import GameSnapshot, GameState, TeamInfo
from src.sports.models.sport_config import SportConfig
from src.sports.models.league_config import LeagueConfig


class TestDisplayConfig(unittest.TestCase):
    """Test DisplayConfig dataclass."""

    def test_from_device_config(self):
        """Test creating DisplayConfig from DeviceConfiguration."""
        device_config = Mock(spec=DeviceConfiguration)
        device_config.matrix_config = Mock()
        device_config.matrix_config.width = 64
        device_config.matrix_config.height = 32
        device_config.matrix_config.brightness = 75
        device_config.matrix_config.pwm_bits = 11
        device_config.matrix_config.hardware_mapping = "regular"
        device_config.matrix_config.chain_length = 1
        device_config.matrix_config.parallel = 1
        device_config.matrix_config.gpio_slowdown = 1
        device_config.render_config = Mock()
        device_config.render_config.logo_variant = "small"
        device_config.render_config.live_layout = "stacked"

        display_config = DisplayConfig.from_device_config(device_config)

        self.assertEqual(display_config.width, 64)
        self.assertEqual(display_config.height, 32)
        self.assertEqual(display_config.brightness, 75)
        self.assertEqual(display_config.pwm_bits, 11)
        self.assertEqual(display_config.hardware_mapping, "regular")
        self.assertEqual(display_config.chain_length, 1)
        self.assertEqual(display_config.parallel, 1)
        self.assertEqual(display_config.gpio_slowdown, 1)
        self.assertEqual(display_config.logo_variant, "small")
        self.assertEqual(display_config.live_layout, "stacked")


class TestBaseDisplayImpl(BaseDisplay):
    """Concrete test implementation of BaseDisplay."""

    def _init_display(self):
        """Initialize test display."""
        pass

    def _flush_display(self):
        """Flush test display."""
        pass


class TestBaseDisplay(unittest.TestCase):
    """Test base display implementation."""

    def setUp(self):
        """Set up test fixtures."""
        self.device_config = self._create_mock_device_config()
        self.display = TestBaseDisplayImpl(self.device_config)

    def _create_mock_device_config(self):
        """Create mock device configuration."""
        config = Mock(spec=DeviceConfiguration)
        config.matrix_config = Mock()
        config.matrix_config.width = 64
        config.matrix_config.height = 32
        config.matrix_config.brightness = 75
        config.matrix_config.pwm_bits = 11
        config.matrix_config.hardware_mapping = "regular"
        config.matrix_config.chain_length = 1
        config.matrix_config.parallel = 1
        config.matrix_config.gpio_slowdown = 1
        config.render_config = Mock()
        config.render_config.logo_variant = "small"
        config.render_config.live_layout = "stacked"
        return config

    def test_initialization(self):
        """Test display initialization."""
        self.assertEqual(self.display.width, 64)
        self.assertEqual(self.display.height, 32)
        self.assertIsNotNone(self.display._buffer)
        self.assertIsNotNone(self.display._draw)
        self.assertIsNotNone(self.display._font_small)
        self.assertIsNotNone(self.display._font_large)
        self.assertIsNotNone(self.display._scene_manager)

    def test_clear(self):
        """Test clearing display buffer."""
        self.display.clear((255, 0, 0))
        # Get pixel from buffer to verify clear worked
        pixel = self.display._buffer.getpixel((0, 0))
        self.assertEqual(pixel, (255, 0, 0))

    def test_render_with_snapshot(self):
        """Test rendering with game snapshot."""
        display = TestBaseDisplayImpl(self.device_config)
        snapshot = self._create_mock_snapshot(GameState.LIVE)
        current_time = datetime.now()

        display.render(snapshot, current_time)

        # Verify the scene manager was called appropriately
        # We can check that the buffer was modified
        self.assertIsNotNone(display._scene_manager.current_scene)

    def test_render_without_snapshot(self):
        """Test rendering without game snapshot (idle)."""
        display = TestBaseDisplayImpl(self.device_config)
        current_time = datetime.now()

        display.render(None, current_time)

        # Should render idle scene
        self.assertEqual(display._scene_manager.get_current_scene_name(), "idle")

    def test_update_configuration(self):
        """Test updating display configuration."""
        new_config = self._create_mock_device_config()
        new_config.render_config.logo_variant = "large"
        new_config.render_config.live_layout = "big-logos"

        self.display.update_configuration(new_config)

        self.assertEqual(self.display.config, new_config)
        self.assertEqual(self.display.display_config.logo_variant, "large")
        self.assertEqual(self.display.display_config.live_layout, "big-logos")

    def test_update_configuration_dimension_change_error(self):
        """Test error when updating configuration with different dimensions."""
        from src.core.exceptions import ConfigurationError

        new_config = self._create_mock_device_config()
        new_config.matrix_config.width = 128  # Different width

        with self.assertRaises(ConfigurationError) as context:
            self.display.update_configuration(new_config)

        self.assertIn("different dimensions", str(context.exception))

    def _create_mock_snapshot(self, state: GameState) -> GameSnapshot:
        """Create mock game snapshot."""
        sport = Mock(spec=SportConfig)
        league = Mock(spec=LeagueConfig)

        return GameSnapshot(
            sport=sport,
            league=league,
            event_id="test123",
            start_time_local=datetime.now(),
            state=state,
            home=TeamInfo(id="1", name="Home", abbr="HOM", score=100),
            away=TeamInfo(id="2", name="Away", abbr="AWY", score=98),
            current_period=4,
            period_name="Q4",
            display_clock="2:30",
            seconds_to_start=-1
        )


class TestMatrixDisplay(unittest.TestCase):
    """Test hardware matrix display implementation."""

    def setUp(self):
        """Set up test fixtures."""
        self.device_config = self._create_mock_device_config()

    def _create_mock_device_config(self):
        """Create mock device configuration."""
        config = Mock(spec=DeviceConfiguration)
        config.matrix_config = Mock()
        config.matrix_config.width = 64
        config.matrix_config.height = 32
        config.matrix_config.brightness = 75
        config.matrix_config.pwm_bits = 11
        config.matrix_config.hardware_mapping = "regular"
        config.matrix_config.chain_length = 1
        config.matrix_config.parallel = 1
        config.matrix_config.gpio_slowdown = 1
        config.render_config = Mock()
        config.render_config.logo_variant = "small"
        config.render_config.live_layout = "stacked"
        return config

    @patch('src.display.matrix.MatrixDisplay._try_init_matrix')
    def test_initialization_with_hardware(self, mock_try_init):
        """Test initialization with hardware available."""
        mock_matrix = Mock()
        mock_try_init.return_value = mock_matrix

        display = MatrixDisplay(self.device_config)

        self.assertEqual(display._matrix, mock_matrix)
        self.assertTrue(display.is_available())

    @patch('src.display.matrix.MatrixDisplay._try_init_matrix')
    def test_initialization_without_hardware(self, mock_try_init):
        """Test initialization without hardware available."""
        mock_try_init.return_value = None

        display = MatrixDisplay(self.device_config)

        self.assertIsNone(display._matrix)
        self.assertFalse(display.is_available())

    @patch('src.display.matrix.MatrixDisplay._try_init_matrix')
    def test_flush_with_hardware(self, mock_try_init):
        """Test flushing to hardware."""
        mock_matrix = Mock()
        mock_try_init.return_value = mock_matrix

        display = MatrixDisplay(self.device_config)
        display._flush_display()

        mock_matrix.SetImage.assert_called_once_with(display._buffer)

    @patch('src.display.matrix.MatrixDisplay._try_init_matrix')
    def test_flush_without_hardware(self, mock_try_init):
        """Test flushing without hardware (should not error)."""
        mock_try_init.return_value = None

        display = MatrixDisplay(self.device_config)
        display._flush_display()  # Should not raise

    @patch('src.display.matrix.MatrixDisplay._try_init_matrix')
    def test_close(self, mock_try_init):
        """Test closing display."""
        mock_matrix = Mock()
        mock_try_init.return_value = mock_matrix

        display = MatrixDisplay(self.device_config)
        display.close()

        mock_matrix.Clear.assert_called_once()
        self.assertIsNone(display._matrix)


class TestSimulatorDisplay(unittest.TestCase):
    """Test simulator display implementation."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.device_config = self._create_mock_device_config()

    def tearDown(self):
        """Clean up test fixtures."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _create_mock_device_config(self):
        """Create mock device configuration."""
        config = Mock(spec=DeviceConfiguration)
        config.matrix_config = Mock()
        config.matrix_config.width = 64
        config.matrix_config.height = 32
        config.matrix_config.brightness = 75
        config.matrix_config.pwm_bits = 11
        config.matrix_config.hardware_mapping = "regular"
        config.matrix_config.chain_length = 1
        config.matrix_config.parallel = 1
        config.matrix_config.gpio_slowdown = 1
        config.render_config = Mock()
        config.render_config.logo_variant = "small"
        config.render_config.live_layout = "stacked"
        return config

    def test_initialization(self):
        """Test simulator display initialization."""
        display = SimulatorDisplay(self.device_config, self.temp_dir)

        self.assertTrue(Path(self.temp_dir).exists())
        self.assertEqual(display.output_dir, Path(self.temp_dir))
        self.assertEqual(display.frame_count, 0)

    def test_flush_creates_png(self):
        """Test that flush creates PNG file."""
        display = SimulatorDisplay(self.device_config, self.temp_dir)
        display._flush_display()

        frame_path = Path(self.temp_dir) / "frame.png"
        self.assertTrue(frame_path.exists())
        self.assertEqual(display.frame_count, 1)

    def test_flush_creates_timestamped_png(self):
        """Test that flush creates timestamped PNG every 100 frames."""
        display = SimulatorDisplay(self.device_config, self.temp_dir)

        # Flush 100 times
        for _ in range(100):
            display._flush_display()

        timestamped_path = Path(self.temp_dir) / "frame_000000.png"
        self.assertTrue(timestamped_path.exists())

    def test_get_last_frame_path(self):
        """Test getting last frame path."""
        display = SimulatorDisplay(self.device_config, self.temp_dir)
        display._flush_display()

        path = display.get_last_frame_path()
        self.assertEqual(path, Path(self.temp_dir) / "frame.png")

    def test_reset_frame_count(self):
        """Test resetting frame count."""
        display = SimulatorDisplay(self.device_config, self.temp_dir)
        display._flush_display()
        display._flush_display()
        self.assertEqual(display.frame_count, 2)

        display.reset_frame_count()
        self.assertEqual(display.frame_count, 0)


class TestMockDisplay(unittest.TestCase):
    """Test mock display implementation."""

    def setUp(self):
        """Set up test fixtures."""
        self.device_config = self._create_mock_device_config()
        self.display = MockDisplay(self.device_config)

    def _create_mock_device_config(self):
        """Create mock device configuration."""
        config = Mock(spec=DeviceConfiguration)
        config.matrix_config = Mock()
        config.matrix_config.width = 64
        config.matrix_config.height = 32
        config.matrix_config.brightness = 75
        config.matrix_config.pwm_bits = 11
        config.matrix_config.hardware_mapping = "regular"
        config.matrix_config.chain_length = 1
        config.matrix_config.parallel = 1
        config.matrix_config.gpio_slowdown = 1
        config.render_config = Mock()
        config.render_config.logo_variant = "small"
        config.render_config.live_layout = "stacked"
        return config

    def test_initialization(self):
        """Test mock display initialization."""
        self.assertEqual(self.display.render_calls, [])
        self.assertEqual(self.display.flush_calls, 0)
        self.assertEqual(self.display.close_calls, 0)

    def test_render_tracking(self):
        """Test that render calls are tracked."""
        snapshot = Mock(spec=GameSnapshot)
        snapshot.state = GameState.LIVE
        current_time = datetime.now()

        self.display.render(snapshot, current_time)

        self.assertEqual(len(self.display.render_calls), 1)
        self.assertEqual(self.display.render_calls[0], (snapshot, current_time))

    def test_flush_tracking(self):
        """Test that flush calls are tracked."""
        self.display.flush()
        self.display.flush()

        self.assertEqual(self.display.flush_calls, 2)

    def test_close_tracking(self):
        """Test that close calls are tracked."""
        self.display.close()

        self.assertEqual(self.display.close_calls, 1)

    def test_config_update_tracking(self):
        """Test that configuration updates are tracked."""
        new_config = self._create_mock_device_config()
        self.display.update_configuration(new_config)

        self.assertEqual(len(self.display.config_updates), 1)
        self.assertEqual(self.display.config_updates[0], new_config)

    def test_get_render_count(self):
        """Test getting render count."""
        self.display.render(None, datetime.now())
        self.display.render(None, datetime.now())

        self.assertEqual(self.display.get_render_count(), 2)

    def test_get_last_render(self):
        """Test getting last render details."""
        snapshot = Mock(spec=GameSnapshot)
        snapshot.state = GameState.LIVE
        current_time = datetime.now()
        self.display.render(snapshot, current_time)

        last_render = self.display.get_last_render()
        self.assertEqual(last_render, (snapshot, current_time))

    def test_reset_mock(self):
        """Test resetting mock state."""
        self.display.render(None, datetime.now())
        self.display.flush()
        self.display.close()
        self.display.reset_mock()

        self.assertEqual(self.display.render_calls, [])
        self.assertEqual(self.display.flush_calls, 0)
        self.assertEqual(self.display.close_calls, 0)

    def test_failure_modes(self):
        """Test configured failure modes."""
        self.display.set_failure_mode(fail_on_flush=True)

        with self.assertRaises(RuntimeError):
            self.display.flush()

        self.display.set_failure_mode(fail_on_render=True, fail_on_flush=False)

        with self.assertRaises(RuntimeError):
            self.display.render(None, datetime.now())

    def test_get_buffer_pixel(self):
        """Test getting pixel from buffer."""
        self.display.clear((255, 0, 0))
        self.display.flush()

        pixel = self.display.get_buffer_pixel(0, 0)
        self.assertEqual(pixel, (255, 0, 0))


if __name__ == '__main__':
    unittest.main()