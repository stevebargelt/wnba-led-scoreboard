import json
import tempfile
import unittest
from pathlib import Path

from src.config.multi_sport_loader import load_multi_sport_config
from src.config.multi_sport_types import convert_multi_sport_to_legacy, SportType


def _write_config(tmp_dir: str, payload: dict) -> Path:
    path = Path(tmp_dir) / "config.json"
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path


class MultiSportConfigLoaderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_loads_valid_multi_sport_config(self) -> None:
        payload = {
            "timezone": "America/Los_Angeles",
            "matrix": {"width": 64, "height": 32},
            "refresh": {"pregame_sec": 30, "ingame_sec": 5, "final_sec": 60},
            "render": {"live_layout": "stacked", "logo_variant": "mini"},
            "sports": [
                {
                    "sport": "wnba",
                    "enabled": True,
                    "priority": 1,
                    "favorites": [
                        {"name": "Seattle Storm", "abbr": "SEA"},
                        {"name": "Minnesota Lynx", "abbr": "MIN"},
                    ],
                },
                {
                    "sport": "nhl",
                    "enabled": True,
                    "priority": 2,
                    "favorites": [
                        {"name": "Seattle Kraken", "abbr": "SEA"},
                    ],
                },
            ],
        }

        config_path = _write_config(self.tmp.name, payload)
        cfg = load_multi_sport_config(str(config_path))

        enabled_sports = cfg.get_enabled_sports()
        self.assertEqual([SportType.WNBA, SportType.NHL], enabled_sports)
        legacy = convert_multi_sport_to_legacy(cfg)
        self.assertEqual("America/Los_Angeles", legacy.timezone)
        self.assertEqual(2, len(legacy.favorites))
        self.assertEqual("SEA", legacy.favorites[0].abbr)

    def test_invalid_config_without_sports_raises(self) -> None:
        payload = {"timezone": "America/Chicago"}
        config_path = _write_config(self.tmp.name, payload)

        with self.assertRaises(ValueError):
            load_multi_sport_config(str(config_path))


if __name__ == "__main__":  # pragma: no cover - manual invocation helper
    unittest.main()
