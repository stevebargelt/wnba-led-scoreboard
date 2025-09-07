from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Optional


ASSETS_DIR = Path("assets")
TEAMS_JSON = ASSETS_DIR / "teams.json"


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
        if not TEAMS_JSON.exists():
            return
        with open(TEAMS_JSON, "r", encoding="utf-8") as f:
            data = json.load(f)
        for t in data.get("teams", []):
            meta = TeamMeta(
                id=str(t.get("id")),
                abbr=(t.get("abbr") or "").upper(),
                name=t.get("name") or t.get("displayName") or t.get("shortName") or "",
                primary=t.get("primary"),
                secondary=t.get("secondary"),
                logo=t.get("logo"),
            )
            if meta.id:
                self.by_id[meta.id] = meta
            if meta.abbr:
                self.by_abbr[meta.abbr] = meta

    def get(self, team_id: Optional[str] = None, abbr: Optional[str] = None) -> Optional[TeamMeta]:
        self.load()
        if team_id and team_id in self.by_id:
            return self.by_id[team_id]
        if abbr:
            return self.by_abbr.get(abbr.upper())
        return None


registry = TeamRegistry()

