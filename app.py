import argparse
import os
import sys
import time
import signal
from datetime import datetime, timezone

from dotenv import load_dotenv

from src.config.loader import load_config
from src.data.enhanced_espn import fetch_scoreboard
from src.model.game import GameSnapshot, GameState
from typing import Optional
from src.select.choose import choose_featured_game
from src.render.renderer import Renderer
from src.demo.simulator import DemoSimulator
from src.runtime.reload import ConfigWatcher
from src.runtime.adaptive_refresh import AdaptiveRefreshManager


RELOAD_REQUESTED = False


def _signal_reload(signum, frame):
    global RELOAD_REQUESTED
    RELOAD_REQUESTED = True


def parse_args():
    parser = argparse.ArgumentParser(description="WNBA LED Scoreboard")
    parser.add_argument("--config", default="config/favorites.json", help="Path to favorites/config JSON")
    parser.add_argument("--sim", action="store_true", help="Force simulate display (no matrix)")
    parser.add_argument("--once", action="store_true", help="Run one update cycle and exit")
    parser.add_argument("--demo", action="store_true", help="Run in demo mode with a simulated game")
    return parser.parse_args()


def main():
    global RELOAD_REQUESTED
    load_dotenv()  # .env overrides
    args = parse_args()

    cfg = load_config(args.config)

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
                fetch_success = True  # Demo mode always succeeds
            else:
                try:
                    scoreboard = fetch_scoreboard(now_local.date())
                    refresh_manager.record_request_success()
                    fetch_success = True
                except Exception as e:
                    print(f"[warn] fetch_scoreboard failed: {e}")
                    refresh_manager.record_request_failure()
                    scoreboard = []
                    fetch_success = False

                snapshot = choose_featured_game(cfg, scoreboard, now_local)

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
                    new_cfg = load_config(args.config)
                    # If matrix size changed, recreate renderer
                    resized = (new_cfg.matrix.width != cfg.matrix.width) or (new_cfg.matrix.height != cfg.matrix.height)
                    cfg = new_cfg
                    if resized:
                        try:
                            renderer.close()
                        except Exception:
                            pass
                        renderer = Renderer(cfg, force_sim=args.sim)
                    else:
                        # For same size, update renderer config reference
                        renderer.cfg = cfg
                    
                    # Update refresh manager with new config
                    refresh_manager = AdaptiveRefreshManager(cfg.refresh)
                    print("[info] Configuration reloaded")
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
