#!/usr/bin/env python3
"""
Fetch NHL team data, logos, and colors, and generate pre-sized variants.
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Optional

import requests
from PIL import Image

# Add src to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from src.sports.nhl import NHLClient


NHL_LOGO_BASE_URL = "https://assets.nhle.com/logos/nhl/svg"
NHL_TEAMS_CACHE_FILE = "assets/nhl_teams.json"
NHL_LOGOS_DIR = "assets/nhl_logos"
NHL_VARIANTS_DIR = "assets/nhl_logos/variants"


def fetch_nhl_teams_data() -> tuple[List[Dict], bool]:
    """Fetch NHL teams data using the NHL client."""
    print("Fetching NHL teams data...")
    
    client = NHLClient()
    teams_data = client.fetch_team_info()
    
    if not teams_data:
        print("❌ Failed to fetch NHL teams data")
        return [], True
    
    print(f"✅ Fetched {len(teams_data)} NHL teams")
    if client.used_static_fallback:
        print("⚠️ Using bundled fallback data (network unavailable)")
    return teams_data, client.used_static_fallback


def download_nhl_logo(team_id: str, team_abbr: str, output_path: Path) -> bool:
    """Download NHL team logo."""
    # NHL logos are available in multiple formats
    logo_urls = [
        f"{NHL_LOGO_BASE_URL}/{team_abbr}_light.svg",
        f"{NHL_LOGO_BASE_URL}/{team_abbr}.svg",
        f"https://www-league.nhlstatic.com/images/logos/teams-current-primary-light/{team_id}.svg",
        f"https://www-league.nhlstatic.com/images/logos/teams-current-primary-dark/{team_id}.svg",
    ]
    
    for url in logo_urls:
        try:
            print(f"  Trying {url}")
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            # For SVG, we need to convert to PNG
            if url.endswith('.svg'):
                # You would need to add SVG to PNG conversion here
                # For now, save as SVG and handle conversion later
                with open(output_path.with_suffix('.svg'), 'wb') as f:
                    f.write(response.content)
                print(f"  ✅ Downloaded SVG logo for {team_abbr}")
                return True
            else:
                with open(output_path, 'wb') as f:
                    f.write(response.content)
                print(f"  ✅ Downloaded logo for {team_abbr}")
                return True
                
        except requests.RequestException as e:
            print(f"  ❌ Failed to download from {url}: {e}")
            continue
    
    print(f"  ❌ Could not download logo for {team_abbr}")
    return False


def create_logo_variants(original_path: Path, team_id: str) -> None:
    """Create mini and banner variants from original logo."""
    if not original_path.exists():
        return
    
    try:
        # For SVG files, skip variant creation for now
        if original_path.suffix.lower() == '.svg':
            print(f"  📝 SVG logo saved for {team_id} (variant creation skipped)")
            return
        
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
            
            mini_path = NHL_VARIANTS_DIR / f"{team_id}_mini.png"
            mini_img.save(mini_path)
            
            # Create banner variant (~20px tall)
            banner_height = 20
            ratio = banner_height / img.height
            banner_width = int(img.width * ratio)
            banner_img = img.resize((banner_width, banner_height), Image.Resampling.LANCZOS)
            
            banner_path = NHL_VARIANTS_DIR / f"{team_id}_banner.png"
            banner_img.save(banner_path)
            
            print(f"  ✅ Created variants for {team_id}")
            
    except Exception as e:
        print(f"  ❌ Failed to create variants for {team_id}: {e}")


def main():
    """Main function to fetch NHL assets."""
    print("🏒 Fetching NHL Teams, Logos, and Colors")
    print("=" * 50)
    
    # Create output directories
    assets_dir = Path("assets")
    nhl_logos_dir = Path(NHL_LOGOS_DIR)
    nhl_variants_dir = Path(NHL_VARIANTS_DIR)
    
    assets_dir.mkdir(exist_ok=True)
    nhl_logos_dir.mkdir(exist_ok=True)
    nhl_variants_dir.mkdir(exist_ok=True)
    
    # Fetch teams data
    teams_data, offline_mode = fetch_nhl_teams_data()
    if not teams_data:
        print("❌ Could not fetch NHL teams data")
        return 1
    
    # Save teams data
    with open(NHL_TEAMS_CACHE_FILE, 'w') as f:
        json.dump(teams_data, f, indent=2, ensure_ascii=False)
    print(f"✅ Saved teams data to {NHL_TEAMS_CACHE_FILE}")
    
    success_count = 0
    if offline_mode:
        print("\n⚠️ Offline fallback in use – skipping logo downloads")
    else:
        print("\nDownloading NHL team logos...")
        for team in teams_data:
            team_id = team.get("id", "")
            team_abbr = team.get("abbreviation", "")
            team_name = team.get("name", "")

            if not team_id or not team_abbr:
                print(f"⚠️  Skipping team with missing ID/abbreviation: {team_name}")
                continue

            print(f"📥 Downloading logo for {team_name} ({team_abbr})...")

            logo_path = nhl_logos_dir / f"{team_id}.png"
            if download_nhl_logo(team_id, team_abbr, logo_path):
                create_logo_variants(logo_path, team_id)
                success_count += 1

    print(f"\n🎯 Summary:")
    print(f"   Teams processed: {len(teams_data)}")
    if offline_mode:
        print("   Logos downloaded: 0 (offline fallback)")
    else:
        print(f"   Logos downloaded: {success_count}")
        print(f"   Success rate: {success_count/len(teams_data)*100:.1f}%")
    
    # Update teams data with local logo paths
    if not offline_mode:
        for team in teams_data:
            team_id = team.get("id", "")
            if team_id:
                logo_file = nhl_logos_dir / f"{team_id}.png"
                svg_file = nhl_logos_dir / f"{team_id}.svg" 

                if logo_file.exists():
                    team["logo"] = str(logo_file)
                elif svg_file.exists():
                    team["logo"] = str(svg_file)

    # Save updated teams data with logo paths (if any)
    with open(NHL_TEAMS_CACHE_FILE, 'w') as f:
        json.dump(teams_data, f, indent=2, ensure_ascii=False)

    if offline_mode:
        print(f"⚠️ Saved fallback team list to {NHL_TEAMS_CACHE_FILE} (no logos downloaded)")
    else:
        print(f"✅ Updated teams data with logo paths")

    print(f"\n🏒 NHL assets ready! Teams data: {NHL_TEAMS_CACHE_FILE}")
    
    return 0


if __name__ == "__main__":
    exit(main())
