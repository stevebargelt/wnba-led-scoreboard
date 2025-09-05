from __future__ import annotations

from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

from src.model.game import GameSnapshot


def draw_final(img: Image.Image, draw: ImageDraw.ImageDraw, snap: GameSnapshot, now_local: datetime,
               font_small: ImageFont.ImageFont, font_large: ImageFont.ImageFont):
    w, h = img.size
    # Final stamp
    draw.text((1, 1), "FINAL", fill=(255, 80, 80), font=font_small)

    # Winner highlight
    away_first = snap.away.score >= snap.home.score
    line1 = f"{snap.away.abbr} {snap.away.score}"
    line2 = f"{snap.home.abbr} {snap.home.score}"
    ymid = (h - 12) // 2
    draw.text((2, ymid), line1, fill=(255, 255, 255), font=font_large if away_first else font_small)
    draw.text((2, ymid + 10), line2, fill=(255, 255, 255), font=font_large if not away_first else font_small)

