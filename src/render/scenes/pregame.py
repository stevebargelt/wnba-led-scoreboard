from __future__ import annotations

from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

from src.model.game import GameSnapshot
from src.assets.logos import get_logo


def draw_pregame(img: Image.Image, draw: ImageDraw.ImageDraw, snap: GameSnapshot, now_local: datetime,
                 font_small: ImageFont.ImageFont, font_large: ImageFont.ImageFont, logo_variant: str = "mini"):
    w, h = img.size
    # Top row: logos + VS
    w, h = img.size
    top_y = 2
    alogo = get_logo(snap.away.id, snap.away.abbr, variant=logo_variant or "mini")
    hlogo = get_logo(snap.home.id, snap.home.abbr, variant=logo_variant or "mini")
    if alogo:
        img.paste(alogo, (2, top_y), alogo)
    if hlogo:
        # place on right
        lw, lh = hlogo.size
        img.paste(hlogo, (w - lw - 2, top_y), hlogo)
    draw.text(((w // 2) - 6, top_y + 1), "VS", fill=(200, 200, 200), font=font_small)

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
