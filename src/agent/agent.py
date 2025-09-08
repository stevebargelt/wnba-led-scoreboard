from __future__ import annotations

import json
import os
import signal
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import threading
from datetime import datetime, timezone
import requests

from .realtime import RealtimeClient, RealtimeConfig

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
        self._rt: Optional[RealtimeClient] = None
        self._hb_thread: Optional[threading.Thread] = None

    def stop(self):
        self._stop = True

    def run(self):
        print("[agent] starting (skeleton)")
        print(f"[agent] device_id={self.cfg.device_id} supabase_url={bool(self.cfg.supabase_url)}")
        # Start realtime if configured
        if self.cfg.supabase_url and self.cfg.device_id and self.cfg.supabase_anon_key:
            # Compose realtime URL; callers should pass full wss URL via SUPABASE_REALTIME_URL to override
            rt_url = os.getenv("SUPABASE_REALTIME_URL") or self.cfg.supabase_url.rstrip("/") + "/realtime/v1/websocket?vsn=1.0.0"
            # Supabase Realtime channels use the 'realtime:' prefix for custom broadcast channels
            topic = f"realtime:device:{self.cfg.device_id}"
            self._rt = RealtimeClient(
                RealtimeConfig(url=rt_url, apikey=self.cfg.supabase_anon_key, access_token=self.cfg.device_token, topic=topic),
                on_message=self._handle_message,
            )
            self._rt.start()

        # Start heartbeat thread (best-effort)
        if self.cfg.supabase_url and self.cfg.device_id and self.cfg.supabase_anon_key:
            self._start_heartbeat()

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

    # Message format: {"type": "APPLY_CONFIG"|"RESTART"|"FETCH_ASSETS"|"SELF_TEST"|"PING", "payload": {...}}
    def _handle_message(self, msg: dict) -> None:
        mtype = (msg.get("type") or "").upper()
        payload = msg.get("payload") or {}
        print(f"[agent] received message: {mtype}")
        if mtype == "APPLY_CONFIG":
            try:
                content = payload if isinstance(payload, dict) else {}
                pid = None
                if isinstance(content.get("__scoreboard_pid__"), int):  # optional testing hook
                    pid = content.pop("__scoreboard_pid__")
                self.apply_config(content, scoreboard_pid=pid)
            except Exception as e:
                print(f"[agent] APPLY_CONFIG error: {e}")
        elif mtype == "RESTART":
            self._restart_service(payload.get("service") or os.getenv("SCOREBOARD_SERVICE", "wnba-led.service"))
        elif mtype == "FETCH_ASSETS":
            self._run_fetch_assets()
        elif mtype == "SELF_TEST":
            self._run_self_test()
        elif mtype == "PING":
            print("[agent] PING received")

    def _restart_service(self, service: str) -> None:
        import subprocess
        try:
            subprocess.run(["sudo", "systemctl", "restart", service], check=True)
            print(f"[agent] restarted {service}")
        except Exception as e:
            print(f"[agent] restart failed: {e}")

    def _run_fetch_assets(self) -> None:
        import subprocess
        try:
            subprocess.run([sys.executable, "scripts/fetch_wnba_assets.py"], check=True)
            print("[agent] fetched assets")
        except Exception as e:
            print(f"[agent] fetch assets failed: {e}")

    def _run_self_test(self) -> None:
        import subprocess
        try:
            subprocess.run(["bash", "scripts/hardware_self_test.sh"], check=True)
            print("[agent] self-test invoked")
        except Exception as e:
            print(f"[agent] self-test failed: {e}")

    # Heartbeat: update devices.last_seen_ts (requires device token for RLS) and optionally insert STATUS event
    def _start_heartbeat(self):
        if self._hb_thread and self._hb_thread.is_alive():
            return

        def loop():
            while not self._stop:
                try:
                    self._send_heartbeat()
                except Exception as e:
                    print(f"[agent] heartbeat error: {e}")
                for _ in range(30):
                    if self._stop:
                        return
                    time.sleep(1)

        self._hb_thread = threading.Thread(target=loop, daemon=True)
        self._hb_thread.start()

    def _send_heartbeat(self):
        if not (self.cfg.supabase_url and self.cfg.device_id and self.cfg.supabase_anon_key):
            return
        headers = {
            "apikey": self.cfg.supabase_anon_key,
        }
        if self.cfg.device_token:
            headers["Authorization"] = f"Bearer {self.cfg.device_token}"

        base = self.cfg.supabase_url.rstrip("/")
        # Update devices.last_seen_ts
        url = f"{base}/rest/v1/devices?id=eq.{self.cfg.device_id}"
        now_iso = datetime.now(timezone.utc).isoformat()
        r = requests.patch(url, headers={**headers, "Content-Type": "application/json", "Prefer": "return=minimal"}, json={"last_seen_ts": now_iso}, timeout=5)
        if 200 <= r.status_code < 300:
            print("[agent] heartbeat OK")
        else:
            print(f"[agent] heartbeat update failed: {r.status_code} {r.text[:200]}")

        # Optional: insert STATUS event if token provided
        if self.cfg.device_token:
            ev_url = f"{base}/rest/v1/events"
            payload = {
                "device_id": self.cfg.device_id,
                "type": "STATUS",
                "payload": {"ts": now_iso},
            }
            re = requests.post(ev_url, headers={**headers, "Content-Type": "application/json"}, json=payload, timeout=5)
            if re.status_code >= 300:
                print(f"[agent] status event failed: {re.status_code} {re.text[:120]}")


def main(argv: list[str]) -> int:
    # CLI: default runs the agent loop; 'apply' subcommand applies a config file once.
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

    # Default: run the agent loop using environment configuration
    cfg = AgentConfig(
        supabase_url=os.getenv("SUPABASE_URL"),
        supabase_anon_key=os.getenv("SUPABASE_ANON_KEY"),
        device_id=os.getenv("DEVICE_ID"),
        device_token=os.getenv("DEVICE_TOKEN"),
        config_path=Path(os.getenv("CONFIG_PATH", "config/favorites.json")),
    )
    agent = DeviceAgent(cfg)
    try:
        agent.run()
        return 0
    except KeyboardInterrupt:
        agent.stop()
        return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
