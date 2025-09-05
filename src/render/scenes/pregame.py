from __future__ import annotations

from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

from src.model.game import GameSnapshot


def draw_pregame(img: Image.Image, draw: ImageDraw.ImageDraw, snap: GameSnapshot, now_local: datetime,
                 font_small: ImageFont.ImageFont, font_large: ImageFont.ImageFont):
    w, h = img.size
    # Top row: AWAY vs HOME
    title = f"{snap.away.abbr} @ {snap.home.abbr}"
    draw.text((1, 1), title, fill=(255, 255, 255), font=font_small)

    # Middle: countdown
    secs = max(0, snap.seconds_to_start)
    hh = secs // 3600
    mm = (secs % 3600) // 60
    ss = secs % 60
    if hh > 0:
        ctext = f"{hh:01d}:{mm:02d}:{ss:02d}"
    else:
        ctext = f"{mm:02d}:{ss:02d}"
    # Center the countdown
    tw, th = draw.textbbox((0, 0), ctext, font=font_large)[2:]
    draw.text(((w - tw) // 2, (h - th) // 2), ctext, fill=(255, 200, 0), font=font_large)

    # Bottom: tip time local
    tip = snap.start_time_local.strftime("Tip %I:%M %p").lstrip('0')
    draw.text((1, h - 9), tip, fill=(150, 150, 150), font=font_small)

