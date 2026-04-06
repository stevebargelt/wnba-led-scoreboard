#!/usr/bin/env python3
"""
Generate preview images for comparison testing with TypeScript implementation.
Used by web-admin/tests/preview/comparison.test.ts to prevent code drift.
"""

import argparse
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.WARNING,
    stream=sys.stderr,
    format='%(levelname)s - %(name)s - %(message)s'
)

from src.config.supabase_config_loader import DeviceConfiguration
from src.preview.generator import PreviewGenerator


def create_default_config() -> DeviceConfiguration:
    """Create default device configuration for testing."""
    return DeviceConfiguration.from_dict({
        "device_id": "test-device",
        "matrix_config": {
            "width": 64,
            "height": 32,
            "brightness": 75,
            "pwm_bits": 11,
            "hardware_mapping": "regular",
            "chain_length": 1,
            "parallel": 1,
            "gpio_slowdown": 1
        },
        "render_config": {
            "logo_variant": "small",
            "live_layout": "stacked"
        }
    })


def main():
    parser = argparse.ArgumentParser(
        description="Generate preview images for comparison testing"
    )
    parser.add_argument(
        "--scene",
        choices=["idle", "pregame", "live", "live_big", "final"],
        required=True,
        help="Scene type to generate"
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output directory for preview images"
    )
    parser.add_argument(
        "--config-json",
        help="JSON configuration (uses default if not provided)"
    )

    args = parser.parse_args()

    try:
        if args.config_json:
            config_data = json.loads(args.config_json)
            config = DeviceConfiguration.from_dict(config_data)
        else:
            config = create_default_config()

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
            raise ValueError(f"Unknown scene type: {args.scene}")

        print(json.dumps({
            "success": True,
            "path": str(frame_path),
            "scene": args.scene
        }))

    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
