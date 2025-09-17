#!/usr/bin/env python3
import json
import sys
from pathlib import Path

# Ensure repo root is on sys.path when running as a script
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.config.multi_sport_loader import load_multi_sport_config  # noqa: E402
from src.assets.teams import (  # noqa: E402
    ASSETS_DIR,
    LEGACY_TEAMS_JSON,
    registry as team_registry,
)
from src.assets.logos import LOGOS_DIR, VARIANTS_DIR  # noqa: E402


def main():
    config_path = 'config/favorites.json'
    multi_cfg = load_multi_sport_config(config_path)

    team_files = []
    if LEGACY_TEAMS_JSON.exists():
        team_files.append(LEGACY_TEAMS_JSON)
    team_files.extend(sorted(p for p in ASSETS_DIR.glob("*_teams.json") if p.exists()))

    print("Team asset files detected:")
    if team_files:
        for path in team_files:
            print(f" - {path}")
    else:
        print(" - none found. Run asset fetch scripts (e.g. scripts/fetch_wnba_assets.py)")

    # Force load
    team_registry.load()
    print(f"team entries loaded: {len(team_registry.by_id)}")

    print(f"logos dir: {LOGOS_DIR} exists={LOGOS_DIR.exists()}")
    print(f"variants dir: {VARIANTS_DIR} exists={VARIANTS_DIR.exists()}")

    if not multi_cfg.sports:
        print("No sports configured in favorites.json")

    for sport_config in multi_cfg.sports:
        sport_label = sport_config.sport.value.upper()
        print(f"\n=== {sport_label} favorites ===")
        if not sport_config.teams:
            print(" (none configured)")
            continue

        for fav in sport_config.teams:
            abbr = (fav.abbr or (fav.name[:3].upper() if fav.name else None))
            meta = team_registry.get(team_id=fav.id, abbr=abbr)
            print("Favorite:", fav.name, f"id={fav.id}", f"abbr={abbr}")
            if meta:
                print(" resolved ->", meta.id, meta.abbr, meta.name)
                logo_path = None
                if meta.logo:
                    logo_path = Path(meta.logo)
                    if not logo_path.is_absolute():
                        logo_path = ASSETS_DIR.parent / logo_path
                    print(" logo path:", logo_path, "exists=", logo_path.exists())
                else:
                    print(" logo path: (not recorded)")

                if logo_path and LOGOS_DIR in logo_path.parents:
                    original = LOGOS_DIR / f"{meta.id}.png"
                    mini = VARIANTS_DIR / f"{meta.id}_mini.png"
                    banner = VARIANTS_DIR / f"{meta.id}_banner.png"
                    print(" original:", original, "exists=", original.exists())
                    print(" mini:", mini, "exists=", mini.exists())
                    print(" banner:", banner, "exists=", banner.exists())
            else:
                print(" WARNING: could not resolve team meta. Ensure the sport-specific team asset files include this team.")


if __name__ == '__main__':
    sys.exit(main())
