from __future__ import annotations

from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

from src.model.game import GameSnapshot
from src.assets.logos import get_logo


def _fit_logo(img: Image.Image, max_w: int = 20, max_h: int = 20) -> Image.Image:
    w, h = img.size
    if w <= max_w and h <= max_h:
        return img
    # scale to fit within max_w x max_h, preserving aspect
    scale = min(max_w / float(w), max_h / float(h))
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    return img.resize((nw, nh), Image.BICUBIC)


def draw_live_big(img: Image.Image, draw: ImageDraw.ImageDraw, snap: GameSnapshot, now_local: datetime,
                  font_small: ImageFont.ImageFont, font_large: ImageFont.ImageFont, logo_variant: str = "banner"):
    w, h = img.size

    # 1) Status line (period + clock) at very top
    period_label = "PRE" if snap.period <= 0 else ("OT" if snap.period > 4 else f"Q{snap.period}")
    clock = (snap.display_clock or "").strip()
    status = f"{period_label} {clock}".strip()
    sth = 0
    if status:
        stw, sth = draw.textbbox((0, 0), status, font=font_small)[2:]
        draw.text(((w - stw) // 2, 0), status, fill=(200, 200, 200), font=font_small)

    # 2) Compute sizes and vertical bands
    desired_logo_h = 20 if h > 32 else 16
    # Abbreviation heights
    habbr = snap.home.abbr[:4]
    aabbr = snap.away.abbr[:4]
    htw, hth = draw.textbbox((0, 0), habbr or "HOM", font=font_small)[2:]
    atw, ath = draw.textbbox((0, 0), aabbr or "AWY", font=font_small)[2:]
    abbr_h = max(hth, ath)

    y_logo_top = 1 + sth
    y_abbr = h - abbr_h - 1
    max_logo_h = max(10, y_abbr - y_logo_top - 1)
    logo_h = min(desired_logo_h, max_logo_h)

    # 3) Paste logos (fit to computed height)
    left_x = 1
    home_x = left_x
    alogo = get_logo(snap.away.id, snap.away.abbr, variant=logo_variant or "banner")
    hlogo = get_logo(snap.home.id, snap.home.abbr, variant=logo_variant or "banner")

    if hlogo:
        hlogo = _fit_logo(hlogo, 20, logo_h)
        img.paste(hlogo, (home_x, y_logo_top), hlogo)
        home_w, home_h = hlogo.size
    else:
        home_w, home_h = 20, logo_h
        draw.rectangle((home_x, y_logo_top, home_x + home_w, y_logo_top + home_h), outline=(100, 100, 100))

    if alogo:
        alogo = _fit_logo(alogo, 20, logo_h)
        away_w, away_h = alogo.size
        away_x = w - 1 - away_w
        img.paste(alogo, (away_x, y_logo_top), alogo)
    else:
        away_w, away_h = 20, logo_h
        away_x = w - 1 - away_w
        draw.rectangle((away_x, y_logo_top, away_x + away_w, y_logo_top + away_h), outline=(100, 100, 100))

    # 4) Abbreviations anchored under the logos at bottom
    hx = home_x + max(0, (home_w - htw) // 2)
    hy = y_abbr
    draw.text((hx, hy), habbr, fill=(220, 220, 220), font=font_small)

    ax = away_x + max(0, (away_w - atw) // 2)
    ay = y_abbr
    draw.text((ax, ay), aabbr, fill=(220, 220, 220), font=font_small)

    # 5) Middle column for scores
    col_l = home_x + home_w + 3
    col_r = away_x - 3
    if col_r <= col_l:
        col_l, col_r = 22, w - 22

    # Use small score font on short matrices to avoid overlap
    force_small = h <= 32
    ascore = str(snap.away.score)
    a_font = font_small if force_small or len(ascore) > 2 else font_large
    astw, asth = draw.textbbox((0, 0), ascore, font=a_font)[2:]
    row1_y = y_logo_top + max(1, logo_h // 4)
    draw.text(((col_l + col_r - astw) // 2, row1_y), ascore, fill=(255, 255, 255), font=a_font)

    hscore = str(snap.home.score)
    h_font = font_small if force_small or len(hscore) > 2 else font_large
    hstw, hsth = draw.textbbox((0, 0), hscore, font=h_font)[2:]
    row2_y = max(row1_y + asth + 1, y_logo_top + logo_h // 2)
    # Keep home score above abbreviations
    if row2_y + hsth > y_abbr - 1:
        row2_y = max(y_logo_top + 1, y_abbr - 1 - hsth)
    draw.text(((col_l + col_r - hstw) // 2, row2_y), hscore, fill=(255, 255, 255), font=h_font)
