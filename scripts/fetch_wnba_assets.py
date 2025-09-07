#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

import requests
from PIL import Image

ASSETS_DIR = Path("assets")
LOGOS_DIR = ASSETS_DIR / "logos"
VARIANTS_DIR = LOGOS_DIR / "variants"
TEAMS_JSON = ASSETS_DIR / "teams.json"

ESPN_TEAMS_URL = "http://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams"


def fetch_teams() -> List[Dict[str, Any]]:
    r = requests.get(ESPN_TEAMS_URL, timeout=float(os.getenv("HTTP_TIMEOUT", "8")))
    r.raise_for_status()
    data = r.json()
    teams = data.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", [])
    out = []
    for t in teams:
        team = t.get("team", {})
        if not team:
            continue
        out.append(team)
    return out


def choose_logo_url(team: Dict[str, Any]) -> str | None:
    logos = team.get("logos") or []
    # Prefer PNG, dark/light agnostic; choose the largest
    best = None
    best_w = 0
    for l in logos:
        href = l.get("href")
        if not href:
            continue
        if not href.lower().endswith((".png", ".jpg", ".jpeg")):
            continue
        w = int(l.get("width") or 0)
        if w >= best_w:
            best_w = w
            best = href
    return best


def download_logo(url: str, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    r = requests.get(url, timeout=float(os.getenv("HTTP_TIMEOUT", "10")))
    r.raise_for_status()
    with open(dest, "wb") as f:
        f.write(r.content)


def make_variant(src: Path, dest: Path, height: int, max_w: int):
    from PIL import ImageOps

    with Image.open(src) as im:
        im = im.convert("RGBA")
        w, h = im.size
        ratio = height / float(h)
        new_w = int(w * ratio)
        if new_w > max_w:
            ratio = max_w / float(w)
            new_w = max_w
            height = int(h * ratio)
        out = im.resize((new_w, height), Image.BICUBIC)
        out = ImageOps.posterize(out.convert("RGB"), 4).convert("RGBA")
        dest.parent.mkdir(parents=True, exist_ok=True)
        out.save(dest)


def main():
    teams = fetch_teams()
    entries: List[Dict[str, Any]] = []
    for t in teams:
        tid = str(t.get("id"))
        abbr = (t.get("abbreviation") or "").upper()
        name = t.get("displayName") or t.get("name")
        primary = t.get("color")
        secondary = t.get("alternateColor")
        logo_url = choose_logo_url(t)
        logo_path = None
        if logo_url:
            dest = LOGOS_DIR / f"{tid}.png"
            try:
                download_logo(logo_url, dest)
                logo_path = str(dest)
                # Variants
                make_variant(dest, VARIANTS_DIR / f"{tid}_mini.png", height=10, max_w=18)
                make_variant(dest, VARIANTS_DIR / f"{tid}_banner.png", height=20, max_w=60)
            except Exception as e:
                print(f"[warn] failed to fetch/generate logo for {abbr or tid}: {e}")

        entries.append({
            "id": tid,
            "abbr": abbr,
            "name": name,
            "primary": f"#{primary}" if primary else None,
            "secondary": f"#{secondary}" if secondary else None,
            "logo": logo_path,
        })

    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    with open(TEAMS_JSON, "w", encoding="utf-8") as f:
        json.dump({"teams": entries}, f, indent=2)
    print(f"Wrote {TEAMS_JSON} and logos in {LOGOS_DIR}")


if __name__ == "__main__":
    sys.exit(main())

