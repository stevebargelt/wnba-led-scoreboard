from __future__ import annotations

from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

from src.model.game import GameSnapshot
from src.assets.logos import get_logo
from ._helpers import infer_team_sport
from src.sports.base import SportType


def draw_pregame(img: Image.Image, draw: ImageDraw.ImageDraw, snap: GameSnapshot, now_local: datetime,
                 font_small: ImageFont.ImageFont, font_large: ImageFont.ImageFont, logo_variant: str = "mini"):
    w, h = img.size
    # Top row: logos + VS
    w, h = img.size
    top_y = 2
    away_sport = infer_team_sport(snap, snap.away)
    home_sport = infer_team_sport(snap, snap.home)

    alogo = get_logo(snap.away.id, snap.away.abbr, sport=away_sport, variant=logo_variant or "mini")
    hlogo = get_logo(snap.home.id, snap.home.abbr, sport=home_sport, variant=logo_variant or "mini")
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

    # Bottom: start time local with sport-appropriate terminology
    # Determine sport for appropriate terminology
    sport = infer_team_sport(snap, snap.home) or infer_team_sport(snap, snap.away)

    # Use "Drop" for NHL, "Tip" for basketball sports
    if sport == SportType.NHL:
        start_term = "Drop"
    else:
        start_term = "Tip"

    start_time = snap.start_time_local.strftime(f"{start_term} %I:%M %p").lstrip('0')
    draw.text((1, h - 9), start_time, fill=(150, 150, 150), font=font_small)
