from __future__ import annotations

import json
import threading
import time
from dataclasses import dataclass
from typing import Callable, Optional


try:
    import websocket  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    websocket = None  # type: ignore


@dataclass
class RealtimeConfig:
    url: str  # e.g., wss://<project>.supabase.co/realtime/v1/websocket
    apikey: str
    access_token: Optional[str] = None  # JWT with RLS claims; optional in dev
    topic: str = "device:unknown"


class RealtimeClient:
    """Very lightweight Phoenix channel client (best-effort).

    Notes:
    - This is a minimal client intended as a scaffold. For production, prefer an
      official or community Supabase Python client with Realtime support.
    - Requires `websocket-client` package.
    """

    def __init__(self, cfg: RealtimeConfig, on_message: Callable[[dict], None]):
        self.cfg = cfg
        self.on_message = on_message
        self.ws = None
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._ref = 0

    def _next_ref(self) -> str:
        self._ref += 1
        return str(self._ref)

    def start(self):
        if websocket is None:
            print("[agent] websocket-client not installed; realtime disabled")
            return
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()
        try:
            if self.ws is not None:
                self.ws.close()
        except Exception:
            pass
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)

    def _run(self):
        # Compose headers
        headers = [
            f"apikey: {self.cfg.apikey}",
            "sec-websocket-protocol: phoenix",
        ]
        if self.cfg.access_token:
            headers.append(f"Authorization: Bearer {self.cfg.access_token}")

        # Connect
        try:
            self.ws = websocket.create_connection(self.cfg.url, header=headers, timeout=10)
            print("[agent] realtime connected")
        except Exception as e:
            print(f"[agent] realtime connect failed: {e}")
            return

        # Join topic
        join_msg = {
            "topic": self.cfg.topic,
            "event": "phx_join",
            "payload": {},
            "ref": self._next_ref(),
        }
        try:
            self.ws.send(json.dumps(join_msg))
        except Exception as e:
            print(f"[agent] join send failed: {e}")
            return

        # Main loop
        last_ping = time.monotonic()
        while not self._stop.is_set():
            try:
                self.ws.settimeout(1.0)
                raw = self.ws.recv()
                if not raw:
                    continue
                msg = json.loads(raw)
                # Expect payloads with {"type": ..., "payload": ...}
                payload = msg.get("payload") or {}
                if isinstance(payload, dict) and payload.get("type"):
                    self.on_message(payload)
            except Exception:
                # Periodic ping to keep socket alive
                if time.monotonic() - last_ping > 15:
                    try:
                        self.ws.send(json.dumps({
                            "topic": "phoenix",
                            "event": "heartbeat",
                            "payload": {},
                            "ref": self._next_ref(),
                        }))
                    except Exception:
                        pass
                    last_ping = time.monotonic()
                continue

