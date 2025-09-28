"""
NHL-style large logo scoreboard rendering.

Layout inspired by falkyre/nhl-led-scoreboard with large team logos
on each side and centered period/score information.
"""

from PIL import Image, ImageDraw, ImageFont
from datetime import datetime
import os
from typing import Optional, Tuple

from src.model.game import GameSnapshot
from src.assets import logos


def load_pixel_fonts() -> Tuple[ImageFont.FreeTypeFont, ImageFont.FreeTypeFont, ImageFont.FreeTypeFont]:
    """
    Load pixel-perfect fonts for LED display.

    Returns:
        Tuple of (small_font, medium_font, large_font)
    """
    font_dir = "assets/fonts/pixel"

    try:
        # Try to load the pixel fonts we downloaded
        small_font = ImageFont.truetype(os.path.join(font_dir, "04B_03B_.TTF"), size=8)
        medium_font = ImageFont.truetype(os.path.join(font_dir, "score_large.otf"), size=16)
        large_font = ImageFont.truetype(os.path.join(font_dir, "score_large.otf"), size=20)
    except Exception as e:
        print(f"[NHL] Failed to load pixel fonts: {e}, falling back to default")
        try:
            # Fallback to system fonts
            small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size=8)
            medium_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size=14)
            large_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size=18)
        except:
            # Last resort: use default font
            small_font = ImageFont.load_default()
            medium_font = ImageFont.load_default()
            large_font = ImageFont.load_default()

    return small_font, medium_font, large_font


def draw_nhl_large_logo(
    buffer: Image.Image,
    draw: ImageDraw.Draw,
    snapshot: GameSnapshot,
    now_local: datetime,
    font_small: Optional[ImageFont.FreeTypeFont] = None,
    font_large: Optional[ImageFont.FreeTypeFont] = None
) -> None:
    """
    Draw NHL-style scoreboard with large team logos.

    Layout (for 64x32 display):
    - Large team logos on left and right sides
    - Period text centered at top
    - Scores below period, centered

    Args:
        buffer: PIL Image buffer to draw on
        draw: ImageDraw instance
        snapshot: Current game snapshot
        now_local: Current local time
        font_small: Small font (optional, will load pixel fonts if not provided)
        font_large: Large font (optional, will load pixel fonts if not provided)
    """
    width = buffer.width
    height = buffer.height

    # Load pixel fonts if not provided
    if font_small is None or font_large is None:
        pixel_small, pixel_medium, pixel_large = load_pixel_fonts()
        font_small = font_small or pixel_small
        font_large = font_large or pixel_medium  # Use medium for scores
        font_period = pixel_small  # Smaller font for period
    else:
        font_period = font_small

    # Clear the buffer with black background
    draw.rectangle([(0, 0), (width - 1, height - 1)], fill=(0, 0, 0))

    # For 64x32 display: logos should be about 24x24
    # For 128x64 display: logos should be about 48x48
    if height == 32:
        logo_size = 24
        logo_y_offset = 4
        period_y = 2
        score_y = 12
        score_font = font_large
    else:  # 128x64 or larger
        logo_size = 48
        logo_y_offset = 8
        period_y = 4
        score_y = 24
        score_font = pixel_large if 'pixel_large' in locals() else font_large

    # Calculate logo positions
    logo_spacing = 8  # Space between logo and edge
    away_logo_x = logo_spacing
    home_logo_x = width - logo_size - logo_spacing

    # Draw away team logo (left side)
    # Get the logo using the correct API (team_id, abbr, sport, variant)
    away_logo = logos.get_logo(
        None,  # team_id
        snapshot.away.abbr,
        sport='NHL',
        variant='banner'  # Use banner for larger base size
    )
    if away_logo:
        # Resize the logo to our desired size
        away_logo = away_logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
        buffer.paste(away_logo, (away_logo_x, logo_y_offset), away_logo)

    # Draw home team logo (right side)
    home_logo = logos.get_logo(
        None,  # team_id
        snapshot.home.abbr,
        sport='NHL',
        variant='banner'  # Use banner for larger base size
    )
    if home_logo:
        # Resize the logo to our desired size
        home_logo = home_logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
        buffer.paste(home_logo, (home_logo_x, logo_y_offset), home_logo)

    # Center area for text (between logos)
    center_x = width // 2

    # Draw period/status at top center
    period_text = _get_period_text(snapshot)
    if period_text:
        # Get text dimensions for centering
        bbox = draw.textbbox((0, 0), period_text, font=font_period)
        text_width = bbox[2] - bbox[0]
        text_x = center_x - (text_width // 2)
        draw.text((text_x, period_y), period_text, fill=(255, 255, 255), font=font_period)

    # Draw scores below period
    away_score = str(snapshot.away.score)
    home_score = str(snapshot.home.score)
    score_text = f"{away_score} - {home_score}"

    # Center the score text
    bbox = draw.textbbox((0, 0), score_text, font=score_font)
    text_width = bbox[2] - bbox[0]
    text_x = center_x - (text_width // 2)

    # Use team colors for scores if available, otherwise white
    draw.text((text_x, score_y), score_text, fill=(255, 255, 255), font=score_font)

    # Draw game clock if available and game is live
    if snapshot.display_clock and str(snapshot.state) == 'GameState.LIVE':
        clock_text = snapshot.display_clock
        # Draw clock below the score
        clock_y = score_y + 10 if height == 32 else score_y + 20
        bbox = draw.textbbox((0, 0), clock_text, font=font_period)
        text_width = bbox[2] - bbox[0]
        text_x = center_x - (text_width // 2)
        draw.text((text_x, clock_y), clock_text, fill=(200, 200, 200), font=font_period)

    # Add power play indicator if applicable (future enhancement)
    # _draw_power_play_indicator(draw, snapshot, width, height)

    # Add shots on goal if available (future enhancement)
    # _draw_shots_on_goal(draw, snapshot, width, height, font_small)


def _get_period_text(snapshot: GameSnapshot) -> str:
    """
    Get the period text for hockey games.

    Args:
        snapshot: Game snapshot

    Returns:
        Period string (1st, 2nd, 3rd, OT, SO, Final)
    """
    if str(snapshot.state) == 'GameState.FINAL':
        return "FINAL"

    period = snapshot.period_name
    if not period:
        return ""

    # Handle hockey-specific periods
    period_lower = period.lower()

    if '1' in period or 'first' in period_lower or '1st' in period_lower:
        return "1ST"
    elif '2' in period or 'second' in period_lower or '2nd' in period_lower:
        return "2ND"
    elif '3' in period or 'third' in period_lower or '3rd' in period_lower:
        return "3RD"
    elif 'ot' in period_lower or 'overtime' in period_lower:
        return "OT"
    elif 'so' in period_lower or 'shootout' in period_lower:
        return "SO"
    else:
        return period.upper()


def _draw_power_play_indicator(draw: ImageDraw.Draw, snapshot: GameSnapshot, width: int, height: int):
    """
    Draw power play indicator if a team has a power play.

    This is a placeholder for future implementation when we have
    penalty/power play data in the game snapshot.
    """
    # TODO: Implement when we have power play data
    pass


def _draw_shots_on_goal(draw: ImageDraw.Draw, snapshot: GameSnapshot, width: int, height: int, font: ImageFont.FreeTypeFont):
    """
    Draw shots on goal if available.

    This is a placeholder for future implementation when we have
    shots on goal data in the game snapshot.
    """
    # TODO: Implement when we have shots data
    pass