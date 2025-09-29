"""Unit tests for display scene management."""

import unittest
from datetime import datetime
from unittest.mock import Mock, MagicMock, patch

from PIL import Image, ImageDraw, ImageFont

from src.display.scenes.registry import Scene, SceneRegistry
from src.display.scenes.manager import SceneManager
from src.display.scenes.builtin import (
    IdleScene, PregameScene, LiveScene, LiveBigScene, FinalScene
)
from src.model.game import GameSnapshot, GameState, TeamInfo
from src.sports.models.sport_config import SportConfig
from src.sports.models.league_config import LeagueConfig


class TestScene(Scene):
    """Test scene implementation."""

    def draw(self, buffer, draw, snapshot, current_time, font_small, font_large, **kwargs):
        """Draw test scene."""
        draw.text((0, 0), "Test", fill=(255, 255, 255), font=font_small)

    def get_name(self):
        """Get scene name."""
        return "test"

    def get_priority(self):
        """Get scene priority."""
        return 5


class TestSceneRegistry(unittest.TestCase):
    """Test scene registry functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.registry = SceneRegistry()

    def test_register_scene(self):
        """Test registering a scene."""
        self.registry.register(TestScene)

        scenes = self.registry.list_scenes()
        self.assertIn("test", scenes)

    def test_register_scene_with_custom_name(self):
        """Test registering a scene with custom name."""
        self.registry.register(TestScene, "custom_name")

        scenes = self.registry.list_scenes()
        self.assertIn("custom_name", scenes)

    def test_unregister_scene(self):
        """Test unregistering a scene."""
        self.registry.register(TestScene)
        self.registry.unregister("test")

        scenes = self.registry.list_scenes()
        self.assertNotIn("test", scenes)

    def test_get_scene(self):
        """Test getting a scene instance."""
        self.registry.register(TestScene)

        scene = self.registry.get_scene("test")
        self.assertIsInstance(scene, TestScene)
        self.assertEqual(scene.get_name(), "test")

    def test_get_scene_singleton(self):
        """Test that get_scene returns same instance."""
        self.registry.register(TestScene)

        scene1 = self.registry.get_scene("test")
        scene2 = self.registry.get_scene("test")
        self.assertIs(scene1, scene2)

    def test_get_nonexistent_scene(self):
        """Test getting nonexistent scene returns None."""
        scene = self.registry.get_scene("nonexistent")
        self.assertIsNone(scene)

    def test_create_default_registry(self):
        """Test creating registry with default scenes."""
        registry = SceneRegistry().create_default_registry()

        scenes = registry.list_scenes()
        self.assertIn("idle", scenes)
        self.assertIn("pregame", scenes)
        self.assertIn("live", scenes)
        self.assertIn("live_big", scenes)
        self.assertIn("final", scenes)


class TestBuiltinScenes(unittest.TestCase):
    """Test built-in scene implementations."""

    def setUp(self):
        """Set up test fixtures."""
        self.buffer = Image.new("RGB", (64, 32))
        self.draw = ImageDraw.Draw(self.buffer)
        self.font_small = ImageFont.load_default()
        self.font_large = ImageFont.load_default()
        self.current_time = datetime.now()

    def test_idle_scene(self):
        """Test idle scene drawing."""
        scene = IdleScene()

        scene.draw(
            self.buffer, self.draw, None, self.current_time,
            self.font_small, self.font_large
        )

        self.assertEqual(scene.get_name(), "idle")
        self.assertEqual(scene.get_priority(), 0)

    @patch('src.render.scenes.pregame.draw_pregame')
    def test_pregame_scene(self, mock_draw):
        """Test pregame scene drawing."""
        scene = PregameScene()
        snapshot = self._create_mock_snapshot(GameState.PRE)

        scene.draw(
            self.buffer, self.draw, snapshot, self.current_time,
            self.font_small, self.font_large, logo_variant="small"
        )

        mock_draw.assert_called_once_with(
            self.buffer, self.draw, snapshot, self.current_time,
            self.font_small, self.font_large, logo_variant="small"
        )
        self.assertEqual(scene.get_name(), "pregame")
        self.assertEqual(scene.get_priority(), 10)

    @patch('src.render.scenes.live.draw_live')
    def test_live_scene(self, mock_draw):
        """Test live scene drawing."""
        scene = LiveScene()
        snapshot = self._create_mock_snapshot(GameState.LIVE)

        scene.draw(
            self.buffer, self.draw, snapshot, self.current_time,
            self.font_small, self.font_large, logo_variant="small"
        )

        mock_draw.assert_called_once_with(
            self.buffer, self.draw, snapshot, self.current_time,
            self.font_small, self.font_large, logo_variant="small"
        )
        self.assertEqual(scene.get_name(), "live")
        self.assertEqual(scene.get_priority(), 20)

    @patch('src.render.scenes.live_big.draw_live_big')
    def test_live_big_scene(self, mock_draw):
        """Test live big scene drawing."""
        scene = LiveBigScene()
        snapshot = self._create_mock_snapshot(GameState.LIVE)

        scene.draw(
            self.buffer, self.draw, snapshot, self.current_time,
            self.font_small, self.font_large
        )

        mock_draw.assert_called_once_with(
            self.buffer, self.draw, snapshot, self.current_time,
            self.font_small, self.font_large, logo_variant="banner"
        )
        self.assertEqual(scene.get_name(), "live_big")
        self.assertEqual(scene.get_priority(), 20)

    @patch('src.render.scenes.final.draw_final')
    def test_final_scene(self, mock_draw):
        """Test final scene drawing."""
        scene = FinalScene()
        snapshot = self._create_mock_snapshot(GameState.FINAL)

        scene.draw(
            self.buffer, self.draw, snapshot, self.current_time,
            self.font_small, self.font_large, logo_variant="small"
        )

        mock_draw.assert_called_once_with(
            self.buffer, self.draw, snapshot, self.current_time,
            self.font_small, self.font_large, logo_variant="small"
        )
        self.assertEqual(scene.get_name(), "final")
        self.assertEqual(scene.get_priority(), 15)

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


class TestSceneManager(unittest.TestCase):
    """Test scene manager functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.registry = SceneRegistry()
        self.registry.register(IdleScene, "idle")
        self.registry.register(PregameScene, "pregame")
        self.registry.register(LiveScene, "live")
        self.registry.register(LiveBigScene, "live_big")
        self.registry.register(FinalScene, "final")

        self.manager = SceneManager(self.registry)
        self.buffer = Image.new("RGB", (64, 32))
        self.draw = ImageDraw.Draw(self.buffer)
        self.font_small = ImageFont.load_default()
        self.font_large = ImageFont.load_default()
        self.current_time = datetime.now()

    def test_select_scene_idle(self):
        """Test selecting idle scene."""
        scene = self.manager.select_scene(None)

        self.assertIsInstance(scene, IdleScene)
        self.assertEqual(self.manager.get_current_scene_name(), "idle")

    def test_select_scene_pregame(self):
        """Test selecting pregame scene."""
        snapshot = self._create_mock_snapshot(GameState.PRE)

        scene = self.manager.select_scene(snapshot)

        self.assertIsInstance(scene, PregameScene)
        self.assertEqual(self.manager.get_current_scene_name(), "pregame")

    def test_select_scene_live_stacked(self):
        """Test selecting live scene with stacked layout."""
        snapshot = self._create_mock_snapshot(GameState.LIVE)
        self.manager.update_context(live_layout="stacked")

        scene = self.manager.select_scene(snapshot)

        self.assertIsInstance(scene, LiveScene)
        self.assertEqual(self.manager.get_current_scene_name(), "live")

    def test_select_scene_live_big_logos(self):
        """Test selecting live big scene with big-logos layout."""
        snapshot = self._create_mock_snapshot(GameState.LIVE)
        self.manager.update_context(live_layout="big-logos")

        scene = self.manager.select_scene(snapshot)

        self.assertIsInstance(scene, LiveBigScene)
        self.assertEqual(self.manager.get_current_scene_name(), "live_big")

    def test_select_scene_final(self):
        """Test selecting final scene."""
        snapshot = self._create_mock_snapshot(GameState.FINAL)

        scene = self.manager.select_scene(snapshot)

        self.assertIsInstance(scene, FinalScene)
        self.assertEqual(self.manager.get_current_scene_name(), "final")

    @patch('src.render.scenes.pregame.draw_pregame')
    def test_render_scene(self, mock_draw):
        """Test rendering a scene."""
        snapshot = self._create_mock_snapshot(GameState.PRE)

        self.manager.render_scene(
            self.buffer, self.draw, snapshot, self.current_time,
            self.font_small, self.font_large
        )

        mock_draw.assert_called_once()

    def test_render_scene_error_handling(self):
        """Test error handling in scene rendering."""
        # Create a scene that will raise an error
        class ErrorScene(Scene):
            def draw(self, *args, **kwargs):
                raise RuntimeError("Test error")

            def get_name(self):
                return "error"

            def get_priority(self):
                return 0

        self.registry.register(ErrorScene, "error")

        # Force selection of error scene
        with patch.object(self.manager, '_determine_scene_name', return_value='error'):
            # Should not raise, but render error message
            self.manager.render_scene(
                self.buffer, self.draw, None, self.current_time,
                self.font_small, self.font_large
            )

    def test_update_context(self):
        """Test updating scene context."""
        self.manager.update_context(
            logo_variant="large",
            live_layout="big-logos",
            custom_param="value"
        )

        self.assertEqual(self.manager.scene_context["logo_variant"], "large")
        self.assertEqual(self.manager.scene_context["live_layout"], "big-logos")
        self.assertEqual(self.manager.scene_context["custom_param"], "value")

    def test_get_available_scenes(self):
        """Test getting available scenes."""
        scenes = self.manager.get_available_scenes()

        self.assertIn("idle", scenes)
        self.assertIn("pregame", scenes)
        self.assertIn("live", scenes)
        self.assertIn("live_big", scenes)
        self.assertIn("final", scenes)

    def test_scene_change_tracking(self):
        """Test that scene changes are tracked."""
        # Start with idle
        self.manager.select_scene(None)
        initial_scene = self.manager.current_scene

        # Change to pregame
        snapshot = self._create_mock_snapshot(GameState.PRE)
        self.manager.select_scene(snapshot)
        new_scene = self.manager.current_scene

        self.assertIsNot(initial_scene, new_scene)

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


if __name__ == '__main__':
    unittest.main()