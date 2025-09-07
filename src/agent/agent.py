from __future__ import annotations

import json
import os
import signal
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class AgentConfig:
    supabase_url: Optional[str]
    supabase_anon_key: Optional[str]
    device_id: Optional[str]
    device_token: Optional[str]
    config_path: Path


class DeviceAgent:
    """Minimal cloud-first agent skeleton.

    MVP behavior:
    - Reads environment for Supabase settings (not yet connecting).
    - Provides helper to apply a config payload to config/favorites.json.
    - Signals the scoreboard with SIGHUP (if PID provided) or by touching the config file to trigger reload.
    """

    def __init__(self, cfg: AgentConfig):
        self.cfg = cfg
        self._stop = False

    def stop(self):
        self._stop = True

    def run(self):
        print("[agent] starting (skeleton)")
        print(f"[agent] device_id={self.cfg.device_id} supabase_url={bool(self.cfg.supabase_url)}")
        # Placeholder loop
        while not self._stop:
            time.sleep(5)
            # In the future: poll or wait on Realtime channel
            # For now: no-op

    def apply_config(self, content: dict, scoreboard_pid: Optional[int] = None) -> None:
        # Write JSON config atomically
        tmp = self.cfg.config_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(content, indent=2), encoding="utf-8")
        tmp.replace(self.cfg.config_path)
        print(f"[agent] wrote config {self.cfg.config_path}")
        # Prefer signaling the running scoreboard if pid provided
        if scoreboard_pid:
            try:
                os.kill(scoreboard_pid, signal.SIGHUP)
                print(f"[agent] signaled SIGHUP to pid {scoreboard_pid}")
                return
            except Exception as e:
                print(f"[agent] SIGHUP failed: {e}")
        # Fallback: update mtime to trigger file watcher
        try:
            os.utime(self.cfg.config_path, None)
        except Exception:
            pass


def main(argv: list[str]) -> int:
    # Simple CLI for local testing: python -m src.agent.agent apply <json-file> [--pid PID]
    if len(argv) >= 2 and argv[1] == "apply":
        json_path = Path(argv[2]) if len(argv) >= 3 else None
        pid = None
        if "--pid" in argv:
            try:
                pid = int(argv[argv.index("--pid") + 1])
            except Exception:
                pid = None
        if not json_path or not json_path.exists():
            print("usage: python -m src.agent.agent apply <json-file> [--pid PID]")
            return 2
        content = json.loads(json_path.read_text(encoding="utf-8"))
        agent = DeviceAgent(AgentConfig(
            supabase_url=os.getenv("SUPABASE_URL"),
            supabase_anon_key=os.getenv("SUPABASE_ANON_KEY"),
            device_id=os.getenv("DEVICE_ID"),
            device_token=os.getenv("DEVICE_TOKEN"),
            config_path=Path(os.getenv("CONFIG_PATH", "config/favorites.json")),
        ))
        agent.apply_config(content, scoreboard_pid=pid)
        return 0

    print("usage: python -m src.agent.agent apply <json-file> [--pid PID]")
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

