from __future__ import annotations

from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

from src.model.game import GameSnapshot
from src.assets.logos import get_logo
from ._helpers import infer_team_sport


def draw_final(img: Image.Image, draw: ImageDraw.ImageDraw, snap: GameSnapshot, now_local: datetime,
               font_small: ImageFont.ImageFont, font_large: ImageFont.ImageFont, logo_variant: str = "mini"):
    w, h = img.size
    # Final stamp
    draw.text((1, 1), "FINAL", fill=(255, 80, 80), font=font_small)

    # Layout similar to live
    row_h = 12
    top_y = 1
    bot_y = top_y + row_h
    logo_x = 1
    abbr_x = 13
    score_right_x = w - 1

    away_sport = infer_team_sport(snap, snap.away)
    alogo = get_logo(snap.away.id, snap.away.abbr, sport=away_sport, variant=logo_variant or "mini")
    if alogo:
        img.paste(alogo, (logo_x, top_y), alogo)
    else:
        draw.rectangle((logo_x, top_y, logo_x + 10, top_y + 10), outline=(100, 100, 100))
    draw.text((abbr_x, top_y + 1), snap.away.abbr[:4], fill=(200, 200, 200), font=font_small)
    ascore = str(snap.away.score)
    atw, _ = draw.textbbox((0, 0), ascore, font=font_large)[2:]
    draw.text((score_right_x - atw, top_y), ascore, fill=(255, 255, 255), font=font_large)

    home_sport = infer_team_sport(snap, snap.home)
    hlogo = get_logo(snap.home.id, snap.home.abbr, sport=home_sport, variant=logo_variant or "mini")
    if hlogo:
        img.paste(hlogo, (logo_x, bot_y), hlogo)
    else:
        draw.rectangle((logo_x, bot_y, logo_x + 10, bot_y + 10), outline=(100, 100, 100))
    draw.text((abbr_x, bot_y + 1), snap.home.abbr[:4], fill=(200, 200, 200), font=font_small)
    hscore = str(snap.home.score)
    htw, _ = draw.textbbox((0, 0), hscore, font=font_large)[2:]
    draw.text((score_right_x - htw, bot_y), hscore, fill=(255, 255, 255), font=font_large)
