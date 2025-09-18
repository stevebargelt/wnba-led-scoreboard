from __future__ import annotations

import io
import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

from PIL import Image, ImageOps

try:
    from urllib.request import Request, urlopen
    from urllib.error import URLError, HTTPError
except ImportError:  # pragma: no cover
    Request = None  # type: ignore
    urlopen = None  # type: ignore
    URLError = HTTPError = Exception  # type: ignore

from .teams import registry as team_registry
try:
    from src.sports.base import SportType
except ImportError:  # pragma: no cover - fallback when running in minimal env
    SportType = None  # type: ignore


BASE_DIR = Path(__file__).resolve().parents[2]
ASSETS_DIR = BASE_DIR / "assets"
LOGOS_DIR = ASSETS_DIR / "logos"
VARIANTS_DIR = LOGOS_DIR / "variants"
SPORT_LOGO_DIRS: Dict[SportType, Path] = {}
if SportType is not None:
    SPORT_LOGO_DIRS = {
        SportType.WNBA: LOGOS_DIR,
        SportType.NHL: ASSETS_DIR / "nhl_logos",
    }
    for _dir in SPORT_LOGO_DIRS.values():
        try:
            _dir.mkdir(parents=True, exist_ok=True)
        except Exception:
            pass

NHL_TEAM_MAP_CACHE = ASSETS_DIR / "nhl_team_ids.json"
NHL_ABBR_TO_NUMERIC: Dict[str, str] = {}
if SportType is not None and hasattr(SportType, "NHL"):
    # Load NHL team mappings from fetched data
    nhl_teams_file = ASSETS_DIR / "nhl_teams.json"
    if nhl_teams_file.exists():
        try:
            with open(nhl_teams_file, "r") as f:
                teams_data = json.load(f)
                NHL_ABBR_TO_NUMERIC = {
                    team.get("abbreviation", "").upper(): str(team.get("id", ""))
                    for team in teams_data
                    if team.get("abbreviation") and team.get("id")
                }
        except Exception:
            NHL_ABBR_TO_NUMERIC = {}

try:
    VARIANTS_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    pass


def _exists_safe(path: Path) -> bool:
    try:
        return path.exists()
    except PermissionError:
        return False


def _safe_open(path: Path) -> Optional[Image.Image]:
    try:
        return Image.open(path).convert("RGBA")
    except Exception:
        return None


def _resolve_path(path_str: str) -> Path:
    path = Path(path_str)
    if not path.is_absolute():
        path = BASE_DIR / path
    return path


def _load_image(path: Path) -> Optional[Image.Image]:
    if path.suffix.lower() == ".svg":
        try:
            import cairosvg  # type: ignore

            png_bytes = cairosvg.svg2png(url=str(path))
            return Image.open(io.BytesIO(png_bytes)).convert("RGBA")
        except Exception:
            return None
    return _safe_open(path)


def _download_remote_logo(abbr: str, sport_type: Optional[SportType]) -> Optional[Image.Image]:
    if SportType is None or sport_type != getattr(SportType, "NHL", None):
        return None
    sport_dir = SPORT_LOGO_DIRS.get(sport_type)
    if sport_dir is None:
        return None
    try:
        sport_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

    abbr_upper = abbr.upper()
    _ensure_nhl_mapping()
    numeric_id = NHL_ABBR_TO_NUMERIC.get(abbr_upper)

    url_candidates = [
        f"https://assets.nhle.com/logos/nhl/svg/{abbr_upper}_light.svg",
        f"https://assets.nhle.com/logos/nhl/svg/{abbr_upper}.svg",
    ]
    if numeric_id and numeric_id.isdigit():
        url_candidates.extend(
            [
                f"https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/{numeric_id}.svg",
                f"https://www-league.nhlstatic.com/images/logos/teams-current-primary-dark/{numeric_id}.svg",
            ]
        )

    for url in url_candidates:
        result = _http_get(url)
        if not result:
            continue
        data, content_type = result
        suffix = Path(url.split("?")[0]).suffix or (
            ".svg" if "svg" in content_type.lower() else ".png"
        )
        target_path = sport_dir / f"{abbr_upper}{suffix}"
        try:
            target_path.write_bytes(data)
        except Exception:
            continue
        img = _load_image(target_path)
        if img:
            return img
    return None


def _http_get(url: str) -> Optional[Tuple[bytes, str]]:
    if urlopen is None:
        return None
    req = Request(url, headers={"User-Agent": "wnba-led-scoreboard/1.0"})
    try:
        with urlopen(req, timeout=10) as resp:  # type: ignore
            data = resp.read()
            ctype = resp.headers.get("Content-Type", "") if hasattr(resp, "headers") else ""
            return data, ctype
    except Exception:
        return None


def _fetch_json(url: str) -> Optional[dict]:
    result = _http_get(url)
    if not result:
        return None
    data, _ = result
    try:
        return json.loads(data.decode("utf-8"))
    except Exception:
        return None


def _extract_team_mapping(records: Iterable[dict]) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for row in records:
        if not isinstance(row, dict):
            continue
        abbr = (
            row.get("abbrev")
            or row.get("triCode")
            or row.get("teamAbbrev")
            or row.get("abbreviation")
        )
        team_id = (
            row.get("id")
            or row.get("teamId")
            or row.get("teamID")
            or row.get("franchiseId")
        )
        if abbr and team_id:
            mapping[str(abbr).upper()] = str(team_id)
    return mapping


def _ensure_nhl_mapping() -> None:
    if SportType is None or not hasattr(SportType, "NHL"):
        return
    if NHL_ABBR_TO_NUMERIC and all(_id.isdigit() for _id in NHL_ABBR_TO_NUMERIC.values()):
        return
    if NHL_TEAM_MAP_CACHE.exists():
        try:
            mapping = json.loads(NHL_TEAM_MAP_CACHE.read_text())
            if isinstance(mapping, dict):
                NHL_ABBR_TO_NUMERIC.update({k.upper(): str(v) for k, v in mapping.items()})
                if NHL_ABBR_TO_NUMERIC and all(_id.isdigit() for _id in NHL_ABBR_TO_NUMERIC.values()):
                    return
        except Exception:
            pass

    sources = [
        ("https://api-web.nhle.com/v1/teams/summary", "teams"),
        ("https://api-web.nhle.com/v1/teams", "teams"),
        ("https://api.nhle.com/stats/rest/en/team", "data"),
    ]

    mapping: Dict[str, str] = {}
    for url, key in sources:
        data = _fetch_json(url)
        if not data:
            continue
        records = None
        if isinstance(data, list):
            records = data
        elif isinstance(data, dict):
            if key and key in data and isinstance(data[key], list):
                records = data[key]
        if records:
            mapping = _extract_team_mapping(records)
        if mapping:
            break

    if mapping:
        NHL_ABBR_TO_NUMERIC.update(mapping)
        try:
            NHL_TEAM_MAP_CACHE.write_text(json.dumps(mapping, indent=2))
        except Exception:
            pass


def _resize_variant(img: Image.Image, target_h: int, max_w: int) -> Image.Image:
    w, h = img.size
    if h == 0:
        return img
    ratio = target_h / float(h)
    new_w = int(w * ratio)
    if new_w > max_w:
        ratio = max_w / float(w)
        new_w = max_w
        target_h = int(h * ratio)
    out = img.resize((new_w, target_h), Image.BICUBIC)
    # Reduce color depth a touch to stabilize appearance
    out = ImageOps.posterize(out.convert("RGB"), 4).convert("RGBA")
    return out


def _variant_path(team_id: str, variant: str) -> Path:
    return VARIANTS_DIR / f"{team_id}_{variant}.png"


@lru_cache(maxsize=128)
def get_logo(
    team_id: Optional[str],
    abbr: Optional[str],
    *,
    sport: Optional[Union[SportType, str]] = None,
    variant: str = "mini",
) -> Optional[Image.Image]:
    variant = variant.lower()
    if not team_id and not abbr:
        return None

    # Prefer team_id
    sport_type: Optional[SportType] = None
    if isinstance(sport, SportType):
        sport_type = sport
    elif isinstance(sport, str):
        try:
            sport_type = SportType(sport.lower())
        except ValueError:
            sport_type = None

    meta = team_registry.get(team_id=team_id, abbr=abbr, sport=sport_type)
    # Prefer canonical meta.id if available, else provided team_id, else abbr
    key_id: Optional[str] = None
    if meta and meta.id:
        key_id = str(meta.id)
    elif team_id:
        key_id = str(team_id)
    elif abbr:
        key_id = abbr.upper()
    if not key_id:
        return None

    # Try variant cache
    cache_key = key_id if not sport_type else f"{sport_type.value}_{key_id}"
    vpath = _variant_path(cache_key, variant)
    if _exists_safe(vpath):
        return _safe_open(vpath)

    # Gather candidate logo directories
    logo_dirs: List[Path] = []
    if sport_type and SPORT_LOGO_DIRS:
        sport_dir = SPORT_LOGO_DIRS.get(sport_type)
        if sport_dir:
            logo_dirs.append(sport_dir)
    if not logo_dirs:
        logo_dirs.append(LOGOS_DIR)

    # Load original: try explicit references, then sport directories by id and abbreviation
    orig_paths = []
    if meta and meta.logo:
        orig_paths.append(_resolve_path(meta.logo))
    for directory in logo_dirs:
        orig_paths.append(directory / f"{key_id}.png")
        orig_paths.append(directory / f"{key_id}.svg")
        if abbr:
            abbr_upper = abbr.upper()
            orig_paths.append(directory / f"{abbr_upper}.png")
            orig_paths.append(directory / f"{abbr_upper}.svg")
            if sport_type == getattr(SportType, "NHL", None) and NHL_ABBR_TO_NUMERIC:
                numeric_id = NHL_ABBR_TO_NUMERIC.get(abbr_upper)
                if numeric_id:
                    orig_paths.append(directory / f"{numeric_id}.png")
                    orig_paths.append(directory / f"{numeric_id}.svg")
        if sport_type == getattr(SportType, "NHL", None) and NHL_ABBR_TO_NUMERIC:
            numeric_id = NHL_ABBR_TO_NUMERIC.get(key_id.upper())
            if numeric_id:
                orig_paths.append(directory / f"{numeric_id}.png")
                orig_paths.append(directory / f"{numeric_id}.svg")

    img = None
    for p in orig_paths:
        if _exists_safe(p):
            img = _load_image(p)
            if img:
                break

    if img is None and abbr:
        remote = _download_remote_logo(abbr, sport_type)
        if remote is not None:
            img = remote

    if img is None:
        return None

    # Build variant
    if variant == "mini":
        target_h, max_w = 10, 18
    else:  # banner
        target_h, max_w = 20, 60

    out = _resize_variant(img, target_h=target_h, max_w=max_w)
    try:
        out.save(vpath)
    except Exception:
        pass
    return out
