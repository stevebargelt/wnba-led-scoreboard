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


def _text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> tuple[int, int]:
    # Robust width/height using bbox (accounts for negative bearings)
    l, t, r, b = draw.textbbox((0, 0), text, font=font)
    return max(0, r - l), max(0, b - t)


def draw_live_big(img: Image.Image, draw: ImageDraw.ImageDraw, snap: GameSnapshot, now_local: datetime,
                  font_small: ImageFont.ImageFont, font_large: ImageFont.ImageFont, logo_variant: str = "banner"):
    w, h = img.size

    # 1) Status line (period + clock) at very top
    period_label = "PRE" if snap.period <= 0 else ("OT" if snap.period > 4 else f"Q{snap.period}")
    clock = (snap.display_clock or "").strip()
    status = f"{period_label} {clock}".strip()
    sth = 0
    if status:
        stw, sth = _text_size(draw, status, font_small)
        draw.text(((w - stw) // 2, 0), status, fill=(200, 200, 200), font=font_small)

    # 2) Compute sizes and vertical bands
    desired_logo_h = 20 if h > 32 else 16
    # Abbreviation heights
    habbr = snap.home.abbr[:4]
    aabbr = snap.away.abbr[:4]
    htw, hth = _text_size(draw, habbr or "HOM", font_small)
    atw, ath = _text_size(draw, aabbr or "AWY", font_small)
    abbr_h = max(hth, ath)

    y_logo_top = 1 + sth
    # Move abbreviations up from the bottom by a small margin to avoid clipping
    bottom_margin = 2
    y_abbr = max(y_logo_top + 1, h - abbr_h - bottom_margin)
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
        away_x = max(1, w - away_w - 2)  # keep a 1px right margin
        img.paste(alogo, (away_x, y_logo_top), alogo)
    else:
        away_w, away_h = 20, logo_h
        away_x = max(1, w - away_w - 2)
        draw.rectangle((away_x, y_logo_top, away_x + away_w, y_logo_top + away_h), outline=(100, 100, 100))

    # 4) Abbreviations anchored under the logos at bottom
    hx = home_x + max(0, (home_w - htw) // 2)
    hy = y_abbr
    # Clamp to screen bounds
    hx = max(1, min(hx, w - htw - 2))
    draw.text((hx, hy), habbr, fill=(220, 220, 220), font=font_small)

    ax = away_x + max(0, (away_w - atw) // 2)
    ay = y_abbr
    ax = max(1, min(ax, w - atw - 2))
    draw.text((ax, ay), aabbr, fill=(220, 220, 220), font=font_small)

    # 5) Scores: left-right near logos (home on left, away on right)
    col_l = home_x + home_w + 3
    col_r = away_x - 3
    if col_r <= col_l:
        col_l, col_r = 22, w - 22
    mid = (col_l + col_r) // 2
    gap = 2

    force_small = h <= 32
    hscore = str(snap.home.score)
    ascore = str(snap.away.score)

    h_font = font_small if force_small or len(hscore) > 2 else font_large
    a_font = font_small if force_small or len(ascore) > 2 else font_large
    hstw, hsth = _text_size(draw, hscore, h_font)
    astw, asth = _text_size(draw, ascore, a_font)

    left_width = max(2, (mid - gap) - col_l)
    right_width = max(2, col_r - (mid + gap))

    # If a score doesn't fit its half, force small font
    if hstw > left_width and h_font is not font_small:
        h_font = font_small
        hstw, hsth = _text_size(draw, hscore, h_font)
    if astw > right_width and a_font is not font_small:
        a_font = font_small
        astw, asth = _text_size(draw, ascore, a_font)

    # Vertical alignment: center within logo band, but keep above abbreviations
    max_score_h = max(hsth, asth)
    score_y = y_logo_top + max(0, (logo_h - max_score_h) // 2)
    if score_y + max_score_h > y_abbr - 1:
        score_y = max(y_logo_top, y_abbr - 1 - max_score_h)

    # Home score: right-aligned to mid-gap
    hx_x = max(col_l, (mid - gap) - hstw)
    # Away score: left-aligned to mid+gap
    ax_x = min(col_r - astw, mid + gap)

    draw.text((hx_x, score_y), hscore, fill=(255, 255, 255), font=h_font)
    draw.text((ax_x, score_y), ascore, fill=(255, 255, 255), font=a_font)
