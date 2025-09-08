#!/usr/bin/env python3
"""
Publish a command to a Supabase Realtime channel (device:<DEVICE_ID>) using Phoenix websocket protocol.

Usage:
  source .venv/bin/activate
  python scripts/publish_command.py --device-id <uuid> --type APPLY_CONFIG --file config/favorites.json \
    --realtime-url wss://<project>.supabase.co/realtime/v1/websocket \
    --apikey <SUPABASE_ANON_KEY> [--token <DEVICE_SCOPED_JWT>]

This is a lightweight publisher for testing the agent end-to-end without a full frontend.
"""
from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Dict

import websocket  # type: ignore


def build_url(base: str, apikey: str, token: str | None) -> str:
    url = base
    sep = '?' if '?' not in url else '&'
    if 'apikey=' not in url:
        url += f"{sep}apikey={apikey}"
        sep = '&'
    if 'vsn=' not in url:
        url += f"{sep}vsn=1.0.0"
    if token and 'token=' not in url:
        url += f"{sep}token={token}"
    return url


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser()
    p.add_argument('--device-id', required=True)
    p.add_argument('--type', required=True, dest='ctype')
    p.add_argument('--file', help='JSON file payload for APPLY_CONFIG')
    p.add_argument('--payload', help='Raw JSON payload string')
    p.add_argument('--realtime-url', required=True)
    p.add_argument('--apikey', required=True)
    p.add_argument('--token')
    args = p.parse_args(argv[1:])

    payload: Dict[str, Any] = {}
    if args.file:
        with open(args.file, 'r', encoding='utf-8') as f:
            payload = json.load(f)
    elif args.payload:
        payload = json.loads(args.payload)

    topic = f"realtime:device:{args.device_id}"
    url = build_url(args.realtime_url, args.apikey, args.token)

    headers = [
        "sec-websocket-protocol: phoenix",
    ]
    if args.token:
        headers.append(f"Authorization: Bearer {args.token}")

    ws = websocket.create_connection(url, header=headers, timeout=10)
    try:
        # join
        ref = 1
        ws.send(json.dumps({"topic": topic, "event": "phx_join", "payload": {}, "ref": str(ref)}))
        ref += 1
        # broadcast command
        msg = {"type": args.ctype.upper(), "payload": payload}
        ws.send(json.dumps({"topic": topic, "event": "broadcast", "payload": msg, "ref": str(ref)}))
        print(f"Published {msg['type']} to {topic}")
    finally:
        try:
            ws.close()
        except Exception:
            pass
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
