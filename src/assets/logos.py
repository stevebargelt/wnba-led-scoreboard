from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Optional

from PIL import Image, ImageOps

from .teams import registry as team_registry


ASSETS_DIR = Path("assets")
LOGOS_DIR = ASSETS_DIR / "logos"
VARIANTS_DIR = LOGOS_DIR / "variants"

VARIANTS_DIR.mkdir(parents=True, exist_ok=True)


def _safe_open(path: Path) -> Optional[Image.Image]:
    try:
        return Image.open(path).convert("RGBA")
    except Exception:
        return None


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
def get_logo(team_id: Optional[str], abbr: Optional[str], variant: str = "mini") -> Optional[Image.Image]:
    variant = variant.lower()
    if not team_id and not abbr:
        return None

    # Prefer team_id
    meta = team_registry.get(team_id=team_id, abbr=abbr)
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
    vpath = _variant_path(key_id, variant)
    if vpath.exists():
        return _safe_open(vpath)

    # Load original: try by id, then abbr
    orig_paths = []
    if meta and meta.logo:
        orig_paths.append(Path(meta.logo))
    # Try by canonical id
    orig_paths.append(LOGOS_DIR / f"{key_id}.png")
    # Fallback to abbr filename
    if abbr:
        orig_paths.append(LOGOS_DIR / f"{abbr.upper()}.png")

    img = None
    for p in orig_paths:
        if p.exists():
            img = _safe_open(p)
            if img:
                break

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
