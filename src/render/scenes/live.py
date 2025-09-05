from __future__ import annotations

from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

from src.model.game import GameSnapshot


def draw_live(img: Image.Image, draw: ImageDraw.ImageDraw, snap: GameSnapshot, now_local: datetime,
              font_small: ImageFont.ImageFont, font_large: ImageFont.ImageFont):
    w, h = img.size
    # Scores line
    top = f"{snap.away.abbr} {snap.away.score}  {snap.home.abbr} {snap.home.score}"
    draw.text((1, 1), top, fill=(255, 255, 255), font=font_small)

    # Clock and period center
    mid = f"P{snap.period} {snap.display_clock or ''}".strip()
    tw, th = draw.textbbox((0, 0), mid, font=font_large)[2:]
    draw.text(((w - tw) // 2, (h - th) // 2), mid, fill=(0, 255, 0), font=font_large)

    # Status detail bottom
    if snap.status_detail:
        draw.text((1, h - 9), snap.status_detail[:20], fill=(150, 150, 150), font=font_small)

