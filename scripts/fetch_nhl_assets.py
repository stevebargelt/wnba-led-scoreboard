#!/usr/bin/env python3
"""
Fetch NHL team data, logos, and colors, and generate pre-sized variants.
"""

import json
import os
import sys
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlparse

import requests
from PIL import Image
import cairosvg
from dotenv import load_dotenv

# Add src to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from src.sports.leagues.nhl import NHLClient, NHL_LEAGUE
from src.sports.definitions import HOCKEY_SPORT


NHL_LOGO_BASE_URLS: Iterable[str] = (
    "https://assets.nhle.com/logos/nhl/svg",
    "https://assets.nhle.com/logos/nhl",
)
NHL_TEAMS_CACHE_FILE = Path("assets/nhl_teams.json")
NHL_LOGOS_DIR = Path("assets/nhl_logos")
NHL_VARIANTS_DIR = Path("assets/nhl_logos/variants")


def fetch_nhl_teams_data() -> tuple[List[Dict], bool]:
    """Fetch NHL teams data using the NHL client."""
    print("Fetching NHL teams data...")
    
    client = NHLClient(NHL_LEAGUE, HOCKEY_SPORT)
    teams_data = client.fetch_teams()
    
    if not teams_data:
        print("❌ Failed to fetch NHL teams data")
        return [], True
    
    print(f"✅ Fetched {len(teams_data)} NHL teams")
    if client.used_static_fallback:
        print("⚠️ Using bundled fallback data (network unavailable)")
    return teams_data, client.used_static_fallback


def _normalize_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    url = url.strip()
    if url.startswith("//"):
        return f"https:{url}"
    if url.startswith("/"):
        return f"https://assets.nhle.com{url}"
    return url


def _candidate_logo_urls(team: Dict[str, Any]) -> List[str]:
    urls: List[str] = []
    abbr = str(team.get("abbreviation", "")).upper()
    team_id = str(team.get("id") or team.get("teamId") or "").strip()

    for field in ("logo", "lightLogo", "darkLogo", "secondaryLogo"):
        urls.append(_normalize_url(team.get(field)))

    logos = team.get("logos")
    if isinstance(logos, dict):
        for value in logos.values():
            urls.append(_normalize_url(value))

    for base in NHL_LOGO_BASE_URLS:
        urls.extend(
            [
                f"{base}/{abbr}_light.svg",
                f"{base}/{abbr}.svg",
            ]
        )

    if team_id:
        urls.extend(
            [
                f"https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/{team_id}.svg",
                f"https://www-league.nhlstatic.com/images/logos/teams-current-primary-dark/{team_id}.svg",
                f"https://assets.nhle.com/logos/nhl/svg/{team_id}.svg",
            ]
        )

    # Filter out None and duplicates while preserving order
    seen = set()
    deduped: List[str] = []
    for url in urls:
        if not url:
            continue
        if url not in seen:
            deduped.append(url)
            seen.add(url)
    return deduped


def _write_png(target: Path, png_bytes: bytes) -> Path:
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(png_bytes)
    return target


def download_nhl_logo(team: Dict[str, Any], logos_dir: Path) -> Optional[Path]:
    """Download NHL team logo and return path to PNG file."""
    team_abbr = str(team.get("abbreviation", "")).upper()
    if not team_abbr:
        return None

    for url in _candidate_logo_urls(team):
        try:
            print(f"  Trying {url}")
            response = requests.get(url, timeout=15)
            response.raise_for_status()
            content = response.content
        except requests.RequestException as e:
            print(f"  ❌ Failed to download from {url}: {e}")
            continue

        parsed = urlparse(url)
        suffix = Path(parsed.path).suffix.lower() or ".svg"
        base_path = logos_dir / team_abbr

        if suffix == ".svg":
            svg_path = base_path.with_suffix(".svg")
            svg_path.write_bytes(content)
            try:
                png_bytes = cairosvg.svg2png(bytestring=content)
                png_path = _write_png(base_path.with_suffix(".png"), png_bytes)
                print(f"  ✅ Downloaded SVG logo for {team_abbr}")
                return png_path
            except Exception as exc:
                print(f"  ⚠️ Failed to render SVG for {team_abbr}: {exc}")
                continue

        try:
            img = Image.open(BytesIO(content)).convert("RGBA")
        except Exception as exc:
            print(f"  ⚠️ Unsupported logo format from {url}: {exc}")
            continue

        png_path = base_path.with_suffix(".png")
        img.save(png_path, format="PNG")
        print(f"  ✅ Downloaded logo for {team_abbr}")
        return png_path

    print(f"  ❌ Could not download logo for {team_abbr}")
    return None


def create_logo_variants(original_path: Path, team_key: str) -> None:
    """Create mini and banner variants from original logo."""
    if not original_path.exists():
        return
    
    try:
        # Load original image
        with Image.open(original_path) as img:
            # Convert to RGBA if needed
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            # Create mini variant (~10px tall)
            mini_height = 10
            ratio = mini_height / img.height
            mini_width = int(img.width * ratio)
            mini_img = img.resize((mini_width, mini_height), Image.Resampling.LANCZOS)
            
            mini_path = NHL_VARIANTS_DIR / f"{team_key}_mini.png"
            mini_img.save(mini_path)
            
            # Create banner variant (~20px tall)
            banner_height = 20
            ratio = banner_height / img.height
            banner_width = int(img.width * ratio)
            banner_img = img.resize((banner_width, banner_height), Image.Resampling.LANCZOS)
            
            banner_path = NHL_VARIANTS_DIR / f"{team_key}_banner.png"
            banner_img.save(banner_path)
            
            print(f"  ✅ Created variants for {team_key}")
            
    except Exception as e:
        print(f"  ❌ Failed to create variants for {team_key}: {e}")


# Current NHL teams (32 active franchises as of 2024-25 season)
CURRENT_NHL_TEAMS = {
    "ANA", "ARI", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL", "DAL",
    "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NJD", "NSH", "NYI", "NYR",
    "OTT", "PHI", "PIT", "SEA", "SJS", "STL", "TBL", "TOR", "VAN", "VGK",
    "WPG", "WSH", "UTA"  # Utah Hockey Club (replaced Arizona Coyotes)
}


def populate_supabase(teams_data: List[Dict[str, Any]]) -> bool:
    """Populate league_teams table in Supabase if credentials are available."""
    try:
        from supabase import create_client

        # Load environment variables
        load_dotenv()
        supabase_url = os.getenv("SUPABASE_URL")
        # Use service role key for admin operations (bypasses RLS)
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

        if not supabase_url or not supabase_key:
            print("ℹ️  Supabase credentials not found, skipping database update")
            return False

        client = create_client(supabase_url, supabase_key)

        # Get NHL league ID
        league_result = client.table('leagues').select('id').eq('code', 'nhl').single().execute()
        if not league_result.data:
            print("⚠️  NHL league not found in database")
            return False

        nhl_league_id = league_result.data['id']

        # Prepare teams data for insertion
        league_teams = []
        for team in teams_data:
            # Only add current teams (those with abbreviations in CURRENT_NHL_TEAMS)
            abbr = str(team.get('abbreviation', '')).upper()
            if abbr in CURRENT_NHL_TEAMS:
                league_teams.append({
                    'league_id': nhl_league_id,
                    'team_id': str(team.get('id') or team.get('teamId', '')),
                    'name': team.get('name', ''),
                    'abbreviation': abbr,
                    'conference': team.get('conference', ''),
                    'division': team.get('division', '')
                })

        # Upsert teams (insert or update)
        if league_teams:
            result = client.table('league_teams').upsert(
                league_teams,
                on_conflict='league_id,team_id'
            ).execute()
            print(f"✅ Updated {len(league_teams)} NHL teams in database")
            return True

    except ImportError:
        print("ℹ️  Supabase library not installed, skipping database update")
        return False
    except Exception as e:
        print(f"⚠️  Failed to update Supabase: {e}")
        return False

    return False


def main():
    """Main function to fetch NHL assets."""
    print("🏒 Fetching NHL Teams, Logos, and Colors")
    print("=" * 50)

    # Create output directories
    assets_dir = Path("assets")
    nhl_logos_dir = NHL_LOGOS_DIR
    nhl_variants_dir = NHL_VARIANTS_DIR
    
    assets_dir.mkdir(exist_ok=True)
    nhl_logos_dir.mkdir(exist_ok=True)
    nhl_variants_dir.mkdir(exist_ok=True)
    
    # Fetch teams data
    teams_data, offline_mode = fetch_nhl_teams_data()
    if not teams_data:
        print("❌ Could not fetch NHL teams data")
        return 1
    
    # Filter to current teams only for logo downloads
    current_teams = [t for t in teams_data if t.get("abbreviation", "").upper() in CURRENT_NHL_TEAMS]
    historical_teams = [t for t in teams_data if t.get("abbreviation", "").upper() not in CURRENT_NHL_TEAMS]

    if historical_teams:
        print(f"ℹ️  Found {len(historical_teams)} historical teams, will skip logo downloads for these")

    # Save all teams data (including historical)
    with open(NHL_TEAMS_CACHE_FILE, 'w') as f:
        json.dump(teams_data, f, indent=2, ensure_ascii=False)
    print(f"✅ Saved all {len(teams_data)} teams data to {NHL_TEAMS_CACHE_FILE}")
    
    success_count = 0
    if offline_mode:
        print("\n⚠️ Offline fallback in use – skipping logo downloads")
    else:
        print(f"\nDownloading logos for {len(current_teams)} current NHL teams...")
        for team in current_teams:
            team_abbr = str(team.get("abbreviation", "")).upper()
            team_name = team.get("name", team_abbr)

            if not team_abbr:
                print(f"⚠️  Skipping team with missing abbreviation: {team_name}")
                continue

            print(f"📥 Downloading logo for {team_name} ({team_abbr})...")

            logo_path = download_nhl_logo(team, nhl_logos_dir)
            if logo_path:
                create_logo_variants(logo_path, team_abbr)
                team["logo"] = str(logo_path)
                success_count += 1

    print(f"\n🎯 Summary:")
    print(f"   Total teams in database: {len(teams_data)}")
    print(f"   Current NHL teams: {len(current_teams)}")
    print(f"   Historical teams: {len(historical_teams)}")
    if offline_mode:
        print("   Logos downloaded: 0 (offline fallback)")
    else:
        print(f"   Logos downloaded: {success_count}/{len(current_teams)}")
        if current_teams:
            print(f"   Success rate: {success_count/len(current_teams)*100:.1f}%")
    
    # Save updated teams data with logo paths (if any)
    with open(NHL_TEAMS_CACHE_FILE, 'w') as f:
        json.dump(teams_data, f, indent=2, ensure_ascii=False)

    if offline_mode:
        print(f"⚠️ Saved fallback team list to {NHL_TEAMS_CACHE_FILE} (no logos downloaded)")
    else:
        print(f"✅ Updated teams data with logo paths")

    print(f"\n🏒 NHL assets ready! Teams data: {NHL_TEAMS_CACHE_FILE}")

    # Populate Supabase if credentials available
    populate_supabase(teams_data)

    return 0


if __name__ == "__main__":
    exit(main())
