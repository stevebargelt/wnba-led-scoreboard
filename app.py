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
from src.sports.aggregator import MultiSportAggregator
from src.render.renderer import Renderer
from src.demo.simulator import DemoSimulator
from src.runtime.reload import ConfigWatcher
from src.runtime.adaptive_refresh import AdaptiveRefreshManager


RELOAD_REQUESTED = False


def _signal_reload(signum, frame):
    global RELOAD_REQUESTED
    RELOAD_REQUESTED = True


def parse_args():
    parser = argparse.ArgumentParser(description="Multi-Sport LED Scoreboard (WNBA/NHL)")
    parser.add_argument("--config", default="config/favorites.json", help="Path to favorites/config JSON")
    parser.add_argument("--sim", action="store_true", help="Force simulate display (no matrix)")
    parser.add_argument("--once", action="store_true", help="Run one update cycle and exit")
    parser.add_argument("--demo", action="store_true", help="Run in demo mode with a simulated game")
    return parser.parse_args()


def main():
    global RELOAD_REQUESTED
    load_dotenv()  # .env overrides
    args = parse_args()

    # Load multi-sport configuration (single source of truth)
    multi_cfg = load_multi_sport_config(args.config)
    multi_cfg = apply_environment_overrides_to_multi_sport_config(multi_cfg)
    cfg = convert_multi_sport_to_legacy(multi_cfg)  # Renderer still consumes legacy shape

    enabled_sports = multi_cfg.get_enabled_sports()
    sport_priorities = multi_cfg.get_sport_priorities()
    multi_sport_aggregator = MultiSportAggregator(sport_priorities, enabled_sports)

    priority_config = multi_cfg.sport_priority
    multi_sport_aggregator.configure_priority_rules(
        live_game_boost=priority_config.live_game_boost,
        favorite_team_boost=priority_config.favorite_team_boost,
        close_game_boost=priority_config.close_game_boost,
        playoff_boost=priority_config.playoff_boost,
        conflict_resolution=priority_config.conflict_resolution,
    )

    print(f"[info] Enabled sports: {[s.value.upper() for s in enabled_sports]}")

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
    demo = DemoSimulator(cfg) if use_demo else None
    
    # Setup adaptive refresh manager
    refresh_manager = AdaptiveRefreshManager(cfg.refresh)

    try:
        while True:
            now_local = datetime.now(cfg.tz)
            if demo is not None:
                snapshot: Optional[GameSnapshot] = demo.get_snapshot(now_local)
            else:
                # Multi-sport mode: use aggregator to get best game across sports
                try:
                    # Build favorite teams dictionary for aggregator
                    favorite_teams = {}
                    for sport_config in getattr(multi_cfg, 'sports', []):
                        if sport_config.enabled:
                            team_identifiers = []
                            for team in sport_config.teams:
                                team_identifiers.extend([team.name, team.abbr])
                                if team.id:
                                    team_identifiers.append(team.id)
                            favorite_teams[sport_config.sport] = team_identifiers

                    enhanced_game = multi_sport_aggregator.get_featured_game(
                        now_local.date(),
                        now_local,
                        favorite_teams,
                    )

                    if enhanced_game:
                        snapshot = enhanced_game.to_legacy_game_snapshot()
                        print(
                            f"[info] Selected {enhanced_game.sport.value.upper()} game: "
                            f"{enhanced_game.away.abbr} @ {enhanced_game.home.abbr} "
                            f"({enhanced_game.selection_reason})"
                        )
                    else:
                        snapshot = None

                    refresh_manager.record_request_success()

                except Exception as e:
                    print(f"[warn] Multi-sport aggregation failed: {e}")
                    refresh_manager.record_request_failure()
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

                    # Rebuild aggregator with updated priorities
                    enabled_sports = multi_cfg.get_enabled_sports()
                    sport_priorities = multi_cfg.get_sport_priorities()
                    multi_sport_aggregator = MultiSportAggregator(sport_priorities, enabled_sports)
                    priority_config = multi_cfg.sport_priority
                    multi_sport_aggregator.configure_priority_rules(
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
                    print(
                        f"[info] Configuration reloaded; enabled sports: "
                        f"{[s.value.upper() for s in enabled_sports]}"
                    )
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
