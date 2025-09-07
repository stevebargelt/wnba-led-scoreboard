#!/usr/bin/env python3
import json
import sys
from pathlib import Path

from src.config.loader import load_config
from src.assets.teams import registry as team_registry, TEAMS_JSON
from src.assets.logos import LOGOS_DIR, VARIANTS_DIR


def main():
    cfg = load_config('config/favorites.json')

    print(f"teams.json present: {TEAMS_JSON.exists()} -> {TEAMS_JSON}")
    if TEAMS_JSON.exists():
        # Force load
        team_registry.load()
        print(f"team entries loaded: {len(team_registry.by_id)}")
    else:
        print("WARNING: assets/teams.json is missing. Run: source .venv/bin/activate && python scripts/fetch_wnba_assets.py")

    print(f"logos dir: {LOGOS_DIR} exists={LOGOS_DIR.exists()}")
    print(f"variants dir: {VARIANTS_DIR} exists={VARIANTS_DIR.exists()}")

    for fav in cfg.favorites:
        abbr = (fav.abbr or (fav.name[:3].upper() if fav.name else None))
        meta = team_registry.get(team_id=fav.id, abbr=abbr)
        print("\nFavorite:", fav.name, f"id={fav.id}", f"abbr={abbr}")
        if meta:
            print(" resolved ->", meta.id, meta.abbr, meta.name)
            original = LOGOS_DIR / f"{meta.id}.png"
            mini = VARIANTS_DIR / f"{meta.id}_mini.png"
            banner = VARIANTS_DIR / f"{meta.id}_banner.png"
            print(" original:", original, "exists=", original.exists())
            print(" mini:", mini, "exists=", mini.exists())
            print(" banner:", banner, "exists=", banner.exists())
        else:
            print(" WARNING: could not resolve team meta. Ensure assets/teams.json exists and includes this team.")


if __name__ == '__main__':
    sys.exit(main())

