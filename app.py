import argparse
import os
import sys
import time
from datetime import datetime, timezone

from dotenv import load_dotenv

from src.config.loader import load_config
from src.data.espn import fetch_scoreboard
from src.model.game import GameSnapshot, GameState
from typing import Optional
from src.select.choose import choose_featured_game
from src.render.renderer import Renderer
from src.demo.simulator import DemoSimulator


def parse_args():
    parser = argparse.ArgumentParser(description="WNBA LED Scoreboard")
    parser.add_argument("--config", default="config/favorites.json", help="Path to favorites/config JSON")
    parser.add_argument("--sim", action="store_true", help="Force simulate display (no matrix)")
    parser.add_argument("--once", action="store_true", help="Run one update cycle and exit")
    parser.add_argument("--demo", action="store_true", help="Run in demo mode with a simulated game")
    return parser.parse_args()


def main():
    load_dotenv()  # .env overrides
    args = parse_args()

    cfg = load_config(args.config)

    renderer = Renderer(cfg, force_sim=args.sim)

    demo_env = os.getenv("DEMO_MODE", "false").lower() == "true"
    use_demo = args.demo or demo_env
    demo = DemoSimulator(cfg) if use_demo else None

    try:
        while True:
            now_local = datetime.now(cfg.tz)
            if demo is not None:
                snapshot: Optional[GameSnapshot] = demo.get_snapshot(now_local)
            else:
                try:
                    scoreboard = fetch_scoreboard(now_local.date())
                except Exception as e:
                    print(f"[warn] fetch_scoreboard failed: {e}")
                    scoreboard = []

                snapshot = choose_featured_game(cfg, scoreboard, now_local)

            if snapshot is None:
                renderer.render_idle(now_local)
                sleep_s = max(30, cfg.refresh.final_sec)
            else:
                if snapshot.state == GameState.PRE:
                    renderer.render_pregame(snapshot, now_local)
                    sleep_s = cfg.refresh.pregame_sec
                    # Tighten cadence close to tip
                    if 0 <= snapshot.seconds_to_start <= 600:
                        sleep_s = min(10, sleep_s)
                elif snapshot.state == GameState.LIVE:
                    renderer.render_live(snapshot, now_local)
                    sleep_s = cfg.refresh.ingame_sec
                else:
                    renderer.render_final(snapshot, now_local)
                    sleep_s = cfg.refresh.final_sec

            renderer.flush()

            if args.once:
                break

            time.sleep(sleep_s)

    except KeyboardInterrupt:
        pass
    finally:
        renderer.close()


if __name__ == "__main__":
    sys.exit(main())
