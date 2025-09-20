import argparse
import os
import sys
import time
import signal
from datetime import datetime, timezone

from dotenv import load_dotenv

from src.config.supabase_config_loader import SupabaseConfigLoader, DeviceConfiguration
from src.config.types import MatrixConfig, RefreshConfig, RenderConfig
from zoneinfo import ZoneInfo
from src.model.game import GameSnapshot, GameState
from src.model.sport_game import EnhancedGameSnapshot
from typing import Optional
from src.sports.league_aggregator import LeagueAggregator
from src.sports.supabase_loader import SupabaseSportsLoader
from supabase import create_client
from src.render.renderer import Renderer
from src.demo.simulator import DemoSimulator, parse_demo_options, DEFAULT_ROTATION_SECONDS
from src.runtime.adaptive_refresh import AdaptiveRefreshManager


RELOAD_REQUESTED = False


def _signal_reload(signum, frame):
    global RELOAD_REQUESTED
    RELOAD_REQUESTED = True


def parse_args():
    parser = argparse.ArgumentParser(description="Multi-League LED Scoreboard")
    parser.add_argument("--config", default="config/favorites.json", help="Path to favorites/config JSON")
    parser.add_argument("--sim", action="store_true", help="Force simulate display (no matrix)")
    parser.add_argument("--once", action="store_true", help="Run one update cycle and exit")
    parser.add_argument("--demo", action="store_true", help="Run in demo mode with a simulated game")
    parser.add_argument(
        "--demo-league",
        action="append",
        help="Limit demo mode to specific leagues (can be provided multiple times)",
    )
    parser.add_argument(
        "--demo-rotation",
        type=int,
        default=None,
        help="Number of seconds to show each league before rotating in demo mode",
    )
    return parser.parse_args()


def main():
    global RELOAD_REQUESTED
    load_dotenv()  # .env overrides
    args = parse_args()

    # Check for Supabase configuration
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_ANON_KEY")
    device_id = os.getenv("DEVICE_ID")

    # Initialize configuration loader
    config_loader = None
    sports_loader = None

    # Try Supabase configuration first
    if supabase_url and supabase_key and device_id:
        try:
            # Create Supabase client
            supabase_client = create_client(supabase_url, supabase_key)

            # Initialize sports/leagues registry
            sports_loader = SupabaseSportsLoader()
            sports_loader.initialize_registry()
            print("[info] Loaded sports and leagues from Supabase")

            # Initialize device config loader
            config_loader = SupabaseConfigLoader(device_id, supabase_client)
            device_config = config_loader.load_full_config()
            print(f"[info] Loaded device {device_id} configuration from Supabase")

        except Exception as e:
            print(f"[warning] Failed to load from Supabase: {e}")
            print("[info] Falling back to local configuration")
            config_loader = None
            sports_loader = None

    # Database configuration is required even for demo mode
    if not config_loader:
        print(f"[error] Configuration required: Set DEVICE_ID, SUPABASE_URL, SUPABASE_ANON_KEY")
        print("[info] Demo mode still requires database configuration for team data")
        sys.exit(1)

    # Setup league aggregator
    if device_config and not (args.demo or os.getenv("DEMO_MODE", "false").lower() == "true"):
        # Using device config for league aggregator
        aggregator = LeagueAggregator(device_config.league_priorities, device_config.enabled_leagues)
        print(f"[info] Enabled leagues: {device_config.enabled_leagues}")
    else:
        # Demo mode doesn't need aggregator
        aggregator = None
        if args.demo or os.getenv("DEMO_MODE", "false").lower() == "true":
            print("[info] Running in demo mode")

    # Configure priority rules for aggregator
    if aggregator:
        # Use default priority rules
        aggregator.configure_priority_rules(
            live_game_boost=True,
            favorite_team_boost=True,
            close_game_boost=True,
            playoff_boost=True,
            conflict_resolution='priority',
        )

    renderer = Renderer(device_config, force_sim=args.sim)

    # Setup signal handler for config reload
    signal.signal(signal.SIGHUP, _signal_reload)
    # Allow SIGUSR1 as alternative on some systems
    try:
        signal.signal(signal.SIGUSR1, _signal_reload)
    except Exception:
        pass

    demo_env = os.getenv("DEMO_MODE", "false").lower() == "true"
    use_demo = args.demo or demo_env

    demo_options = None
    if use_demo:
        env_demo_leagues = os.getenv("DEMO_LEAGUES")
        forced_leagues = args.demo_league or (
            env_demo_leagues.split(",") if env_demo_leagues else None
        )
        env_rotation = os.getenv("DEMO_ROTATION_SECONDS")
        rotation_seconds = args.demo_rotation
        if rotation_seconds is None and env_rotation is not None:
            try:
                rotation_seconds = int(env_rotation)
            except ValueError:
                rotation_seconds = None
        demo_options = parse_demo_options(
            forced_leagues=forced_leagues,
            rotation_seconds=rotation_seconds or DEFAULT_ROTATION_SECONDS,
        )

    demo = DemoSimulator(device_config, options=demo_options) if use_demo else None
    
    # Setup adaptive refresh manager
    refresh_manager = AdaptiveRefreshManager(device_config.refresh_config)

    try:
        while True:
            now_local = datetime.now(device_config.tz)
            if demo is not None:
                snapshot: Optional[GameSnapshot] = demo.get_snapshot(now_local)
            elif aggregator:
                # League mode: use aggregator to get best game across leagues
                try:
                    # Build favorite teams dictionary for aggregator
                    favorite_teams = {}
                    if device_config:
                        # Convert TeamInfo objects to team IDs for aggregator
                        for league_code, teams in device_config.favorite_teams.items():
                            favorite_teams[league_code] = [team.team_id for team in teams]

                    league_game = aggregator.get_featured_game(
                        now_local.date(),
                        now_local,
                        favorite_teams,
                    )

                    if league_game:
                        # Convert LeagueGameSnapshot to GameSnapshot for renderer
                        snapshot = GameSnapshot(
                            event_id=league_game.event_id,
                            start_time_local=league_game.start_time_local,
                            state=league_game.state,
                            home=league_game.home,
                            away=league_game.away,
                            status_detail=league_game.status_detail,
                            period=league_game.current_period,
                            display_clock=league_game.display_clock,
                            seconds_to_start=league_game.seconds_to_start,
                        )
                        print(
                            f"[info] Selected {league_game.league.name} game: "
                            f"{league_game.away.abbr} @ {league_game.home.abbr}"
                        )
                    else:
                        snapshot = None

                    refresh_manager.record_request_success()

                except Exception as e:
                    print(f"[warn] League aggregation failed: {e}")
                    refresh_manager.record_request_failure()
                    snapshot = None
            else:
                # No aggregator and no demo - just idle
                snapshot = None

            # Render appropriate scene
            if snapshot is None:
                renderer.render_idle(now_local)
            else:
                if snapshot.state == GameState.PRE:
                    renderer.render_pregame(snapshot, now_local)
                elif snapshot.state == GameState.LIVE:
                    renderer.render_live(snapshot, now_local)
                else:
                    renderer.render_final(snapshot, now_local)
            
            # Use adaptive refresh interval
            sleep_s = refresh_manager.get_refresh_interval(snapshot, now_local)

            renderer.flush()

            # Check for config refresh from Supabase
            if config_loader and (config_loader.should_refresh(60) or RELOAD_REQUESTED):
                try:
                    RELOAD_REQUESTED = False
                    # Reload from Supabase
                    new_device_config = config_loader.load_full_config()

                    # Update renderer if matrix size changed
                    resized = (
                        new_device_config.matrix_config.width != device_config.matrix_config.width
                        or new_device_config.matrix_config.height != device_config.matrix_config.height
                    )

                    old_config = device_config
                    device_config = new_device_config

                    if resized:
                        try:
                            renderer.close()
                        except Exception:
                            pass
                        renderer = Renderer(device_config, force_sim=args.sim)
                    else:
                        renderer.cfg = device_config

                    # Update aggregator with new leagues if not in demo mode
                    if aggregator:
                        aggregator = LeagueAggregator(device_config.league_priorities, device_config.enabled_leagues)
                        aggregator.configure_priority_rules(
                            live_game_boost=True,
                            favorite_team_boost=True,
                            close_game_boost=True,
                            playoff_boost=True,
                            conflict_resolution='priority',
                        )

                    refresh_manager = AdaptiveRefreshManager(device_config.refresh_config)
                    config_loader.update_heartbeat()
                    print(f"[info] Configuration refreshed from Supabase")

                except Exception as e:
                    print(f"[warn] Config refresh failed: {e}")

            if args.once:
                break

            time.sleep(sleep_s)

    except KeyboardInterrupt:
        pass
    finally:
        renderer.close()


if __name__ == "__main__":
    sys.exit(main())
