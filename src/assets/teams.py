from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, Optional


BASE_DIR = Path(__file__).resolve().parents[2]
ASSETS_DIR = BASE_DIR / "assets"
LEGACY_TEAMS_JSON = ASSETS_DIR / "teams.json"
# Backward-compatible alias; code elsewhere may still reference TEAMS_JSON.
TEAMS_JSON = LEGACY_TEAMS_JSON


@dataclass
class TeamMeta:
    id: str
    abbr: str
    name: str
    primary: Optional[str] = None
    secondary: Optional[str] = None
    logo: Optional[str] = None  # path to original


class TeamRegistry:
    def __init__(self):
        self.by_id: Dict[str, TeamMeta] = {}
        self.by_abbr: Dict[str, TeamMeta] = {}
        self._loaded = False

    def load(self):
        if self._loaded:
            return
        self._loaded = True

        for team_file in self._enumerate_team_files():
            records = self._load_team_file(team_file)
            if not records:
                continue
            for record in records:
                meta = self._build_team_meta(record)
                if not meta:
                    continue
                if meta.id:
                    self.by_id[meta.id] = meta
                if meta.abbr:
                    self.by_abbr[meta.abbr] = meta

    def _enumerate_team_files(self) -> Iterable[Path]:
        # Prefer sport-specific files, but keep legacy support for assets/teams.json.
        if LEGACY_TEAMS_JSON.exists():
            yield LEGACY_TEAMS_JSON
        # *_teams.json files hold sport-scoped data (wnba_teams.json, nhl_teams.json, etc.).
        for path in sorted(ASSETS_DIR.glob("*_teams.json")):
            if path == LEGACY_TEAMS_JSON:
                continue
            yield path

    def _load_team_file(self, path: Path) -> Iterable[dict]:
        try:
            with path.open("r", encoding="utf-8") as fh:
                data = json.load(fh)
        except PermissionError as exc:
            print(f"[warn] cannot read team asset file {path}: {exc}")
            return []
        except json.JSONDecodeError as exc:
            print(f"[warn] invalid JSON in team asset file {path}: {exc}")
            return []

        if isinstance(data, dict):
            teams = data.get("teams")
            if isinstance(teams, list):
                return teams
            return []
        if isinstance(data, list):
            return data
        return []

    def _build_team_meta(self, record: dict) -> Optional[TeamMeta]:
        if not isinstance(record, dict):
            return None

        team_id = record.get("id") or record.get("team_id") or record.get("external_id")
        abbr = record.get("abbr") or record.get("abbreviation") or record.get("shortDisplayName")
        name = (
            record.get("name")
            or record.get("displayName")
            or record.get("shortName")
            or record.get("teamName")
        )

        if not (team_id or abbr or name):
            return None

        colors = record.get("colors") or {}
        primary = record.get("primary") or colors.get("primary")
        secondary = record.get("secondary") or colors.get("secondary")

        logo = record.get("logo")
        if not logo:
            logos = record.get("logos") or {}
            if isinstance(logos, dict):
                logo = logos.get("primary") or logos.get("original")
            elif isinstance(logos, list) and logos:
                logo = logos[0]

        meta = TeamMeta(
            id=str(team_id) if team_id is not None else "",
            abbr=str(abbr).upper() if abbr else "",
            name=str(name) if name else "",
            primary=primary,
            secondary=secondary,
            logo=logo,
        )

        if not meta.id and not meta.abbr:
            return None
        return meta

    def get(self, team_id: Optional[str] = None, abbr: Optional[str] = None) -> Optional[TeamMeta]:
        self.load()
        if team_id and team_id in self.by_id:
            return self.by_id[team_id]
        if abbr:
            return self.by_abbr.get(abbr.upper())
        return None


registry = TeamRegistry()
