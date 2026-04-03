"""
Preview generator for web admin interface.
"""

from datetime import datetime
from pathlib import Path
from typing import Optional

from src.config.supabase_config_loader import DeviceConfiguration, SupabaseConfigLoader
from src.display.simulator import SimulatorDisplay
from src.display.scenes.manager import SceneManager
from src.model.game import GameSnapshot, GameState, TeamInfo
from src.render.fonts import FontManager
from src.core.logging import get_logger
from src.sports.definitions.basketball import BASKETBALL_SPORT
from src.sports.leagues.wnba import WNBA_LEAGUE

logger = get_logger(__name__)


class PreviewGenerator:
    """Generates preview images of scoreboard displays."""

    def __init__(self, config: DeviceConfiguration, output_dir: str = "out/preview"):
        """
        Initialize preview generator.

        Args:
            config: Device configuration
            output_dir: Directory to save preview images
        """
        self.config = config
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_idle_scene(self) -> Path:
        """Generate preview of idle scene."""
        display = SimulatorDisplay(self.config, str(self.output_dir))
        scene_manager = SceneManager()
        scene_manager.update_context(
            live_layout=self.config.render_config.live_layout,
            logo_variant=self.config.render_config.logo_variant
        )

        font_mgr = FontManager()
        font_small = font_mgr.get_font("small")
        font_large = font_mgr.get_font("default")

        buffer = display.get_buffer()
        draw = display.get_draw()

        scene_manager.render_scene(
            buffer=buffer,
            draw=draw,
            snapshot=None,
            current_time=datetime.now(),
            font_small=font_small,
            font_large=font_large
        )

        display.flush()
        path = display.get_last_frame_path()
        display.close()

        return path

    def generate_pregame_scene(self, use_demo: bool = True) -> Path:
        """
        Generate preview of pregame scene.

        Args:
            use_demo: Use demo game data
        """
        display = SimulatorDisplay(self.config, str(self.output_dir))
        scene_manager = SceneManager()
        scene_manager.update_context(
            live_layout=self.config.render_config.live_layout,
            logo_variant=self.config.render_config.logo_variant
        )

        font_mgr = FontManager()
        font_small = font_mgr.get_font("small")
        font_large = font_mgr.get_font("default")

        snapshot = self._create_demo_pregame_snapshot() if use_demo else None

        buffer = display.get_buffer()
        draw = display.get_draw()

        scene_manager.render_scene(
            buffer=buffer,
            draw=draw,
            snapshot=snapshot,
            current_time=datetime.now(),
            font_small=font_small,
            font_large=font_large
        )

        display.flush()
        path = display.get_last_frame_path()
        display.close()

        return path

    def generate_live_scene(self, use_demo: bool = True, big_logos: bool = False) -> Path:
        """
        Generate preview of live game scene.

        Args:
            use_demo: Use demo game data
            big_logos: Use big-logos layout
        """
        display = SimulatorDisplay(self.config, str(self.output_dir))
        scene_manager = SceneManager()
        scene_manager.update_context(
            live_layout="big-logos" if big_logos else "stacked",
            logo_variant=self.config.render_config.logo_variant
        )

        font_mgr = FontManager()
        font_small = font_mgr.get_font("small")
        font_large = font_mgr.get_font("default")

        snapshot = self._create_demo_live_snapshot() if use_demo else None

        buffer = display.get_buffer()
        draw = display.get_draw()

        scene_manager.render_scene(
            buffer=buffer,
            draw=draw,
            snapshot=snapshot,
            current_time=datetime.now(),
            font_small=font_small,
            font_large=font_large
        )

        display.flush()
        path = display.get_last_frame_path()
        display.close()

        return path

    def generate_final_scene(self, use_demo: bool = True) -> Path:
        """
        Generate preview of final scene.

        Args:
            use_demo: Use demo game data
        """
        display = SimulatorDisplay(self.config, str(self.output_dir))
        scene_manager = SceneManager()
        scene_manager.update_context(
            live_layout=self.config.render_config.live_layout,
            logo_variant=self.config.render_config.logo_variant
        )

        font_mgr = FontManager()
        font_small = font_mgr.get_font("small")
        font_large = font_mgr.get_font("default")

        snapshot = self._create_demo_final_snapshot() if use_demo else None

        buffer = display.get_buffer()
        draw = display.get_draw()

        scene_manager.render_scene(
            buffer=buffer,
            draw=draw,
            snapshot=snapshot,
            current_time=datetime.now(),
            font_small=font_small,
            font_large=font_large
        )

        display.flush()
        path = display.get_last_frame_path()
        display.close()

        return path

    def _create_demo_pregame_snapshot(self) -> GameSnapshot:
        """Create demo pregame game data."""
        from datetime import timedelta

        start_time = datetime.now() + timedelta(hours=2)
        period = 1
        period_name = BASKETBALL_SPORT.get_period_name(period)

        return GameSnapshot(
            sport=BASKETBALL_SPORT,
            league=WNBA_LEAGUE,
            event_id="demo-pregame",
            state=GameState.PRE,
            start_time_local=start_time,
            home=TeamInfo(
                id="1",
                name="Mercury",
                abbr="PHX",
                score=0
            ),
            away=TeamInfo(
                id="2",
                name="Sparks",
                abbr="LA",
                score=0
            ),
            current_period=period,
            period_name=period_name,
            display_clock="",
            seconds_to_start=7200,
            status_detail="7:00 PM ET"
        )

    def _create_demo_live_snapshot(self) -> GameSnapshot:
        """Create demo live game data."""
        period = 3
        period_name = BASKETBALL_SPORT.get_period_name(period)

        return GameSnapshot(
            sport=BASKETBALL_SPORT,
            league=WNBA_LEAGUE,
            event_id="demo-live",
            state=GameState.LIVE,
            start_time_local=datetime.now(),
            home=TeamInfo(
                id="1",
                name="Mercury",
                abbr="PHX",
                score=72
            ),
            away=TeamInfo(
                id="2",
                name="Sparks",
                abbr="LA",
                score=68
            ),
            current_period=period,
            period_name=period_name,
            display_clock="5:42",
            seconds_to_start=-1,
            status_detail=f"{period_name} 5:42"
        )

    def _create_demo_final_snapshot(self) -> GameSnapshot:
        """Create demo final game data."""
        period = 4
        period_name = BASKETBALL_SPORT.get_period_name(period)

        return GameSnapshot(
            sport=BASKETBALL_SPORT,
            league=WNBA_LEAGUE,
            event_id="demo-final",
            state=GameState.FINAL,
            start_time_local=datetime.now(),
            home=TeamInfo(
                id="1",
                name="Mercury",
                abbr="PHX",
                score=89
            ),
            away=TeamInfo(
                id="2",
                name="Sparks",
                abbr="LA",
                score=82
            ),
            current_period=period,
            period_name=period_name,
            display_clock="",
            seconds_to_start=-1,
            status_detail="Final"
        )
