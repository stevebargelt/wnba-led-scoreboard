"""
Direct Supabase configuration loader - simplified architecture without agent/websockets.
"""

from datetime import datetime
from typing import Dict, List, Optional
from dataclasses import dataclass
from supabase import Client
from zoneinfo import ZoneInfo

from src.config.types import MatrixConfig, RefreshConfig, RenderConfig


@dataclass
class TeamInfo:
    """Full team information from database."""
    team_id: str
    name: str
    abbreviation: str
    league_code: str
    logo_url: Optional[str] = None


@dataclass
class DeviceConfiguration:
    """Complete device configuration from Supabase."""
    device_id: str
    timezone: str
    enabled: bool
    matrix_config: MatrixConfig
    render_config: RenderConfig
    refresh_config: RefreshConfig
    enabled_leagues: List[str]
    league_priorities: List[str]  # Ordered list of leagues by priority
    favorite_teams: Dict[str, List[TeamInfo]]  # league_code -> team info
    last_updated: datetime
    tz: Optional[ZoneInfo] = None


class SupabaseConfigLoader:
    """
    Loads device configuration from Supabase using secure database functions.
    Uses service role key for function access with proper device ownership validation.
    """

    def __init__(self, device_id: str, service_client: Client):
        """
        Initialize the config loader.

        Args:
            device_id: UUID of the device
            service_client: Supabase client with service role key
        """
        self.device_id = device_id
        self.client = service_client
        self._last_updated: Optional[datetime] = None
        self._cached_config: Optional[DeviceConfiguration] = None
        self._last_heartbeat: Optional[datetime] = None

    def load_full_config(self) -> DeviceConfiguration:
        """
        Load complete configuration from Supabase using database function.

        Returns:
            DeviceConfiguration with all settings
        """
        try:
            # Call the database function to get complete config
            response = self.client.rpc('get_device_configuration', {
                'p_device_id': self.device_id
            }).execute()

            if not response.data:
                # Create default config if none exists
                return self._create_default_config()

            config_data = response.data

            # Parse enabled leagues
            enabled_leagues = [
                league['code'] for league in config_data.get('enabled_leagues', [])
            ]

            # Parse league priorities (same order as enabled leagues)
            league_priorities = enabled_leagues.copy()

            # Parse favorite teams with full team info
            favorite_teams: Dict[str, List[TeamInfo]] = {}
            for league_code, teams in config_data.get('favorite_teams', {}).items():
                favorite_teams[league_code] = [
                    TeamInfo(
                        team_id=team['team_id'],
                        name=team['name'],
                        abbreviation=team['abbreviation'],
                        league_code=league_code,
                        logo_url=team.get('logo_url')
                    )
                    for team in teams
                ]

            # Parse matrix config
            matrix_data = config_data.get('matrix_config', {})
            matrix_config = MatrixConfig(
                width=matrix_data.get('width', 128),
                height=matrix_data.get('height', 64),
                brightness=matrix_data.get('brightness', 100)
            )

            # Parse render config
            render_data = config_data.get('render_config', {})
            render_config = RenderConfig(
                live_layout=render_data.get('live_layout', 'stacked'),
                logo_variant=render_data.get('logo_variant', 'mini')
            )

            # Parse refresh config
            refresh_data = config_data.get('refresh_config', {})
            refresh_config = RefreshConfig(
                pregame_sec=refresh_data.get('pregame_sec', 600),
                ingame_sec=refresh_data.get('ingame_sec', 120),
                final_sec=refresh_data.get('final_sec', 900)
            )

            # Get timezone object
            timezone = config_data.get('timezone', 'America/Los_Angeles')
            try:
                tz = ZoneInfo(timezone)
            except Exception:
                tz = ZoneInfo('America/Los_Angeles')

            # 5. Build complete configuration
            device_config = DeviceConfiguration(
                device_id=self.device_id,
                timezone=timezone,
                enabled=True,
                matrix_config=matrix_config,
                render_config=render_config,
                refresh_config=refresh_config,
                enabled_leagues=enabled_leagues,
                league_priorities=league_priorities,
                favorite_teams=favorite_teams,
                last_updated=datetime.now(),
                tz=tz
            )

            # Cache the config
            self._cached_config = device_config
            self._last_updated = datetime.now()

            return device_config

        except Exception as e:
            print(f"[error] Failed to load config from Supabase: {e}")
            # Return cached config if available
            if self._cached_config:
                print("[info] Using cached configuration")
                return self._cached_config
            # Otherwise return default
            return self._create_default_config()

    def _create_default_config(self) -> DeviceConfiguration:
        """Create a default configuration for new devices."""
        print(f"[info] Creating default config for device {self.device_id}")

        # Try to insert default config to database
        try:
            self.client.table('device_config').insert({
                'device_id': self.device_id,
                'timezone': 'America/Los_Angeles',
                'enabled': True
            }).execute()
        except Exception as e:
            print(f"[warning] Could not create default config in DB: {e}")

        tz = ZoneInfo('America/Los_Angeles')
        return DeviceConfiguration(
            device_id=self.device_id,
            timezone='America/Los_Angeles',
            enabled=True,
            matrix_config=MatrixConfig(width=128, height=64, brightness=100),
            render_config=RenderConfig(),
            refresh_config=RefreshConfig(),
            enabled_leagues=['wnba', 'nhl'],
            league_priorities=['wnba', 'nhl'],
            favorite_teams={},
            last_updated=datetime.now(),
            tz=tz
        )

    def should_refresh(self, interval_seconds: int = 60) -> bool:
        """
        Check if configuration should be refreshed.

        Args:
            interval_seconds: How often to refresh (default 60)

        Returns:
            True if config should be refreshed
        """
        if not self._last_updated:
            return True

        elapsed = (datetime.now() - self._last_updated).total_seconds()
        return elapsed >= interval_seconds

    def update_heartbeat(self) -> None:
        """Update the device's last_seen_at timestamp using database function."""
        # Only send heartbeat every 5 minutes to reduce DB writes
        if self._last_heartbeat:
            elapsed = (datetime.now() - self._last_heartbeat).total_seconds()
            if elapsed < 300:  # 5 minutes
                return

        try:
            self.client.rpc('device_heartbeat', {
                'p_device_id': self.device_id
            }).execute()
            self._last_heartbeat = datetime.now()
            print(f"[debug] Heartbeat sent for device {self.device_id}")
        except Exception as e:
            print(f"[warning] Failed to update heartbeat: {e}")

    def get_refresh_interval(self, has_live_game: bool = False) -> int:
        """
        Get the appropriate refresh interval based on game state.

        Args:
            has_live_game: Whether there's currently a live game

        Returns:
            Seconds until next refresh
        """
        if not self._cached_config:
            return 30  # Default fallback

        if has_live_game:
            return self._cached_config.refresh_config.ingame_sec
        else:
            return self._cached_config.refresh_config.pregame_sec