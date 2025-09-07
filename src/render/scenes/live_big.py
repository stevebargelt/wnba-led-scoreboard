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

    # Status line at very top: period + clock (avoids bottom overlap)
    period_label = "PRE" if snap.period <= 0 else ("OT" if snap.period > 4 else f"Q{snap.period}")
    clock = (snap.display_clock or "").strip()
    status = f"{period_label} {clock}".strip()
    if status:
        stw, sth = draw.textbbox((0, 0), status, font=font_small)[2:]
        draw.text(((w - stw) // 2, 0), status, fill=(200, 200, 200), font=font_small)

    # Place logos below the status line, then abbreviations under logos
    top_y = 1 + (sth if status else 0)
    left_x = 1

    alogo = get_logo(snap.away.id, snap.away.abbr, variant=logo_variant or "banner")
    hlogo = get_logo(snap.home.id, snap.home.abbr, variant=logo_variant or "banner")

    # Home logo on left
    home_x = left_x
    if hlogo:
        hlogo = _fit_logo(hlogo, 20, 20)
        img.paste(hlogo, (home_x, top_y), hlogo)
        home_w, home_h = hlogo.size
    else:
        home_w, home_h = 20, 20
        draw.rectangle((home_x, top_y, home_x + home_w, top_y + home_h), outline=(100, 100, 100))

    # Away logo on right
    if alogo:
        alogo = _fit_logo(alogo, 20, 20)
        away_w, away_h = alogo.size
        away_x = w - 1 - away_w
        img.paste(alogo, (away_x, top_y), alogo)
    else:
        away_w, away_h = 20, 20
        away_x = w - 1 - away_w
        draw.rectangle((away_x, top_y, away_x + away_w, top_y + away_h), outline=(100, 100, 100))

    # Abbreviations under logos, centered under the image width
    habbr = snap.home.abbr[:4]
    htw, hth = draw.textbbox((0, 0), habbr, font=font_small)[2:]
    hx = home_x + max(0, (home_w - htw) // 2)
    hy = min(h - hth - 1, top_y + home_h + 1)
    draw.text((hx, hy), habbr, fill=(220, 220, 220), font=font_small)

    aabbr = snap.away.abbr[:4]
    atw, ath = draw.textbbox((0, 0), aabbr, font=font_small)[2:]
    ax = away_x + max(0, (away_w - atw) // 2)
    ay = min(h - ath - 1, top_y + away_h + 1)
    draw.text((ax, ay), aabbr, fill=(220, 220, 220), font=font_small)

    # Center column between logos for period, scores, and clock
    col_l = home_x + home_w + 3
    col_r = away_x - 3
    if col_r <= col_l:
        col_l, col_r = 22, w - 22  # fallback safe column

    # Scores only (no abbr) stacked in column to prevent overlap
    ascore = str(snap.away.score)
    a_font = font_large if len(ascore) <= 2 else font_small
    astw, asth = draw.textbbox((0, 0), ascore, font=a_font)[2:]
    row1_y = top_y + 5
    draw.text(((col_l + col_r - astw) // 2, row1_y), ascore, fill=(255, 255, 255), font=a_font)

    hscore = str(snap.home.score)
    h_font = font_large if len(hscore) <= 2 else font_small
    hstw, hsth = draw.textbbox((0, 0), hscore, font=h_font)[2:]
    # Ensure second score sits well above the abbreviations under logos
    row2_y = row1_y + max(asth, 10) + 2
    max_abbr_y = max(hy + hth, ay + ath)
    # Clamp row2 to be at least 2px above abbr lines if possible
    if row2_y + hsth > max_abbr_y - 2:
        row2_y = max(top_y + 2, max_abbr_y - 2 - hsth)
    draw.text(((col_l + col_r - hstw) // 2, row2_y), hscore, fill=(255, 255, 255), font=h_font)
