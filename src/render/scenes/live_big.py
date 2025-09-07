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

    # Logo placements (target 20x20), centered vertically
    top_y = max(0, (h - 20) // 2)
    left_x = 1
    right_x = w - 1 - 20

    alogo = get_logo(snap.away.id, snap.away.abbr, variant=logo_variant or "banner")
    hlogo = get_logo(snap.home.id, snap.home.abbr, variant=logo_variant or "banner")

    if hlogo:
        hlogo = _fit_logo(hlogo, 20, 20)
        img.paste(hlogo, (left_x, top_y), hlogo)
    else:
        draw.rectangle((left_x, top_y, left_x + 20, top_y + 20), outline=(100, 100, 100))

    if alogo:
        alogo = _fit_logo(alogo, 20, 20)
        # place flush right
        ax = w - 1 - alogo.size[0]
        img.paste(alogo, (ax, top_y), alogo)
    else:
        draw.rectangle((right_x, top_y, right_x + 20, top_y + 20), outline=(100, 100, 100))

    # Center text column boundaries
    col_l = left_x + 20 + 2  # 23
    col_r = w - 1 - 20 - 2   # 41 (for 64-wide)

    # Period at top of column
    per_text = f"Q{snap.period}" if snap.period >= 1 else "PRE"
    ptw, pth = draw.textbbox((0, 0), per_text, font=font_small)[2:]
    draw.text(((col_l + col_r - ptw) // 2, max(0, top_y - pth)), per_text, fill=(200, 200, 200), font=font_small)

    # Two stacked rows for abbr + scores
    row1_y = top_y + 2
    row2_y = top_y + 12

    # Away row (right side logo)
    aabbr = snap.away.abbr[:4]
    ascore = str(snap.away.score)
    # choose font size for score depending on length
    a_font = font_large if len(ascore) <= 2 else font_small
    stw, _ = draw.textbbox((0, 0), ascore, font=a_font)[2:]
    # left-align abbr, right-align score
    draw.text((col_l, row1_y), aabbr, fill=(220, 220, 220), font=font_small)
    draw.text((col_r - stw, row1_y - 2), ascore, fill=(255, 255, 255), font=a_font)

    # Home row (left side logo)
    habbr = snap.home.abbr[:4]
    hscore = str(snap.home.score)
    h_font = font_large if len(hscore) <= 2 else font_small
    htw, _ = draw.textbbox((0, 0), hscore, font=h_font)[2:]
    draw.text((col_l, row2_y), habbr, fill=(220, 220, 220), font=font_small)
    draw.text((col_r - htw, row2_y - 2), hscore, fill=(255, 255, 255), font=h_font)

    # Clock bottom center of column
    clock = (snap.display_clock or "").strip()
    if clock:
        ctw, cth = draw.textbbox((0, 0), clock, font=font_small)[2:]
        cy = min(h - cth - 1, top_y + 20)
        draw.text(((col_l + col_r - ctw) // 2, cy), clock, fill=(0, 255, 0), font=font_small)

