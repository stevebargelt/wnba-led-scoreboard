import argparse
import os
import sys
import time
import signal
from datetime import datetime, timezone

from dotenv import load_dotenv

from src.config.multi_sport_loader import load_multi_sport_config, apply_environment_overrides_to_multi_sport_config
from src.config.multi_sport_types import convert_multi_sport_to_legacy
from src.model.game import GameSnapshot, GameState
from src.model.sport_game import EnhancedGameSnapshot
from typing import Optional
from src.sports.league_aggregator import LeagueAggregator
from src.sports.supabase_loader import SupabaseSportsLoader
from src.render.renderer import Renderer
from src.demo.simulator import DemoSimulator, parse_demo_options, DEFAULT_ROTATION_SECONDS
from src.runtime.reload import ConfigWatcher
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

    # Initialize Supabase sports/leagues (required unless in demo mode)
    loader = None
    if os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_ANON_KEY"):
        try:
            loader = SupabaseSportsLoader()
            loader.initialize_registry()
            print("[info] Loaded sports and leagues from Supabase")
        except Exception as e:
            print(f"[warning] Failed to load from Supabase: {e}")
            loader = None

    if not loader and not (args.demo or os.getenv("DEMO_MODE", "false").lower() == "true"):
        print("[error] Supabase configuration required (set SUPABASE_URL and SUPABASE_ANON_KEY)")
        print("[info] To run without Supabase, use --demo mode")
        sys.exit(1)

    # Load configuration for rendering settings
    multi_cfg = load_multi_sport_config(args.config)
    multi_cfg = apply_environment_overrides_to_multi_sport_config(multi_cfg)
    cfg = convert_multi_sport_to_legacy(multi_cfg)  # Renderer still consumes legacy shape

    # Get device configuration from Supabase or environment
    device_id = os.getenv("DEVICE_ID")
    if loader:
        if device_id:
            enabled_leagues = loader.load_device_leagues(device_id)
            print(f"[info] Loaded device {device_id} configuration from Supabase")
        else:
            # Fall back to environment variable
            enabled_leagues_env = os.getenv("ENABLED_LEAGUES", "wnba,nhl")
            enabled_leagues = [l.strip() for l in enabled_leagues_env.split(",")]
            print("[info] Using ENABLED_LEAGUES from environment")

        # Get priorities from environment
        league_priorities_env = os.getenv("LEAGUE_PRIORITIES", "wnba,nhl,nba,pwhl")
        league_priorities = [l.strip() for l in league_priorities_env.split(",")]

        # Create league aggregator
        aggregator = LeagueAggregator(league_priorities, enabled_leagues)
    else:
        # In demo mode without loader, create a minimal aggregator
        aggregator = None

    # Configure priority rules from configuration
    if aggregator:
        priority_config = multi_cfg.sport_priority
        aggregator.configure_priority_rules(
            live_game_boost=priority_config.live_game_boost,
            favorite_team_boost=priority_config.favorite_team_boost,
            close_game_boost=priority_config.close_game_boost,
            playoff_boost=priority_config.playoff_boost,
            conflict_resolution=priority_config.conflict_resolution,
        )
        print(f"[info] Enabled leagues: {enabled_leagues}")
    else:
        print("[info] Running in demo mode without league aggregator")

    renderer = Renderer(cfg, force_sim=args.sim)

    # Setup config watcher and signal handler
    watcher = ConfigWatcher([args.config, ".env"])  # .env optional
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

    demo = DemoSimulator(multi_cfg, cfg, options=demo_options) if use_demo else None
    
    # Setup adaptive refresh manager
    refresh_manager = AdaptiveRefreshManager(cfg.refresh)

    try:
        while True:
            now_local = datetime.now(cfg.tz)
            if demo is not None:
                snapshot: Optional[GameSnapshot] = demo.get_snapshot(now_local)
            elif aggregator:
                # League mode: use aggregator to get best game across leagues
                try:
                    # Build favorite teams dictionary for aggregator
                    favorite_teams = {}

                    # If we have a device ID, load favorites from Supabase
                    if device_id:
                        for league_code in enabled_leagues:
                            favorites = loader.load_device_favorites(device_id, league_code)
                            if favorites:
                                favorite_teams[league_code] = favorites
                    else:
                        # Fall back to config file for favorites (temporary compatibility)
                        for sport_config in getattr(multi_cfg, 'sports', []):
                            if sport_config.enabled:
                                team_identifiers = []
                                for team in sport_config.teams:
                                    for candidate in (team.name, team.abbr, team.id):
                                        if candidate:
                                            team_identifiers.append(candidate)
                                # Map sport to league codes
                                sport_to_leagues = {
                                    'wnba': ['wnba'],
                                    'nhl': ['nhl'],
                                    'nba': ['nba'],
                                }
                                for league_code in sport_to_leagues.get(sport_config.sport, []):
                                    if league_code in enabled_leagues:
                                        favorite_teams[league_code] = team_identifiers

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

            # Check for reload request or config file change
            do_reload = False
            if RELOAD_REQUESTED:
                do_reload = True
            elif watcher.changed():
                do_reload = True

            if do_reload:
                RELOAD_REQUESTED = False
                try:
                    multi_cfg = load_multi_sport_config(args.config)
                    multi_cfg = apply_environment_overrides_to_multi_sport_config(multi_cfg)
                    new_cfg = convert_multi_sport_to_legacy(multi_cfg)

                    # Rebuild aggregator with updated configuration
                    if device_id:
                        enabled_leagues = loader.load_device_leagues(device_id)
                    else:
                        enabled_leagues_env = os.getenv("ENABLED_LEAGUES", "wnba,nhl")
                        enabled_leagues = [l.strip() for l in enabled_leagues_env.split(",")]

                    aggregator = LeagueAggregator(league_priorities, enabled_leagues)
                    priority_config = multi_cfg.sport_priority
                    aggregator.configure_priority_rules(
                        live_game_boost=priority_config.live_game_boost,
                        favorite_team_boost=priority_config.favorite_team_boost,
                        close_game_boost=priority_config.close_game_boost,
                        playoff_boost=priority_config.playoff_boost,
                        conflict_resolution=priority_config.conflict_resolution,
                    )

                    # If matrix size changed, recreate renderer
                    resized = (
                        new_cfg.matrix.width != cfg.matrix.width
                        or new_cfg.matrix.height != cfg.matrix.height
                    )
                    cfg = new_cfg
                    if resized:
                        try:
                            renderer.close()
                        except Exception:
                            pass
                        renderer = Renderer(cfg, force_sim=args.sim)
                    else:
                        renderer.cfg = cfg

                    refresh_manager = AdaptiveRefreshManager(cfg.refresh)
                    print(f"[info] Configuration reloaded; enabled leagues: {enabled_leagues}")
                except Exception as e:
                    print(f"[warn] reload failed: {e}")

            if args.once:
                break

            time.sleep(sleep_s)

    except KeyboardInterrupt:
        pass
    finally:
        renderer.close()


if __name__ == "__main__":
    sys.exit(main())
