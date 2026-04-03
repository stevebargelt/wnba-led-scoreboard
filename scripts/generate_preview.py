#!/usr/bin/env python3
"""
CLI script to generate preview images for web admin.
"""

import argparse
import json
import sys
from pathlib import Path

from src.config.supabase_config_loader import DeviceConfiguration
from src.preview.generator import PreviewGenerator


def main():
    parser = argparse.ArgumentParser(description="Generate LED display preview")
    parser.add_argument("--device-id", required=True, help="Device ID")
    parser.add_argument(
        "--scene",
        choices=["idle", "pregame", "live", "live_big", "final"],
        default="live",
        help="Scene type to generate"
    )
    parser.add_argument("--output", default="out/preview", help="Output directory")
    parser.add_argument("--config-json", help="JSON configuration (if not loading from Supabase)")

    args = parser.parse_args()

    try:
        if args.config_json:
            config_data = json.loads(args.config_json)
            config = DeviceConfiguration.from_dict(config_data)
        else:
            from src.config.supabase_config_loader import SupabaseConfigLoader

            loader = SupabaseConfigLoader()
            config = loader.load_configuration(args.device_id)
            if not config:
                print(json.dumps({"error": "Device not found"}))
                sys.exit(1)

        generator = PreviewGenerator(config, args.output)

        if args.scene == "idle":
            frame_path = generator.generate_idle_scene()
        elif args.scene == "pregame":
            frame_path = generator.generate_pregame_scene(use_demo=True)
        elif args.scene == "live":
            frame_path = generator.generate_live_scene(use_demo=True, big_logos=False)
        elif args.scene == "live_big":
            frame_path = generator.generate_live_scene(use_demo=True, big_logos=True)
        elif args.scene == "final":
            frame_path = generator.generate_final_scene(use_demo=True)
        else:
            frame_path = generator.generate_live_scene(use_demo=True)

        print(json.dumps({
            "success": True,
            "path": str(frame_path),
            "scene": args.scene
        }))

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
