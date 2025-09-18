from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import DefaultDict, Dict, Iterable, Optional, Tuple

from src.sports.base import SportType


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
    sport: Optional[SportType] = None


class TeamRegistry:
    def __init__(self):
        self.by_id: Dict[str, TeamMeta] = {}
        self.by_abbr: Dict[str, TeamMeta] = {}
        self.by_sport_abbr: DefaultDict[SportType, Dict[str, TeamMeta]] = defaultdict(dict)
        self.by_sport_id: DefaultDict[SportType, Dict[str, TeamMeta]] = defaultdict(dict)
        self._loaded = False

    def load(self):
        if self._loaded:
            return
        self._loaded = True

        for sport_hint, team_file in self._enumerate_team_files():
            records = self._load_team_file(team_file)
            if not records:
                continue
            for record in records:
                meta = self._build_team_meta(record, sport_hint=sport_hint)
                if not meta:
                    continue
                if meta.id:
                    self.by_id[meta.id] = meta
                    if meta.sport:
                        self.by_sport_id[meta.sport][meta.id] = meta
                if meta.abbr:
                    # Preserve first loaded entry globally to avoid overriding assets unintentionally
                    self.by_abbr.setdefault(meta.abbr, meta)
                    if meta.sport:
                        self.by_sport_abbr[meta.sport].setdefault(meta.abbr, meta)

    def _enumerate_team_files(self) -> Iterable[Tuple[Optional[SportType], Path]]:
        # Prefer sport-specific files, but keep legacy support for assets/teams.json.
        if LEGACY_TEAMS_JSON.exists():
            yield None, LEGACY_TEAMS_JSON
        # *_teams.json files hold sport-scoped data (wnba_teams.json, nhl_teams.json, etc.).
        for path in sorted(ASSETS_DIR.glob("*_teams.json")):
            if path == LEGACY_TEAMS_JSON:
                continue
            sport_name = path.stem.replace("_teams", "")
            sport_type = None
            try:
                sport_type = SportType(sport_name)
            except ValueError:
                sport_type = None
            yield sport_type, path

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

    def _build_team_meta(self, record: dict, sport_hint: Optional[SportType] = None) -> Optional[TeamMeta]:
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

        sport_value = record.get("sport")
        sport: Optional[SportType] = None
        if isinstance(sport_value, str):
            try:
                sport = SportType(sport_value.lower())
            except ValueError:
                sport = None
        elif isinstance(sport_value, SportType):
            sport = sport_value
        if not sport:
            sport = sport_hint

        meta = TeamMeta(
            id=str(team_id) if team_id is not None else "",
            abbr=str(abbr).upper() if abbr else "",
            name=str(name) if name else "",
            primary=primary,
            secondary=secondary,
            logo=logo,
            sport=sport,
        )

        if not meta.id and not meta.abbr:
            return None
        return meta

    def get(
        self,
        team_id: Optional[str] = None,
        abbr: Optional[str] = None,
        sport: Optional[SportType] = None,
    ) -> Optional[TeamMeta]:
        self.load()
        if sport:
            if team_id and team_id in self.by_sport_id.get(sport, {}):
                return self.by_sport_id[sport][team_id]
            if abbr and abbr.upper() in self.by_sport_abbr.get(sport, {}):
                return self.by_sport_abbr[sport][abbr.upper()]
        if team_id and team_id in self.by_id:
            return self.by_id[team_id]
        if abbr:
            return self.by_abbr.get(abbr.upper())
        return None


registry = TeamRegistry()
