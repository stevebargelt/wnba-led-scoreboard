"""
Direct Supabase configuration loader - simplified architecture without agent/websockets.
"""

import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from supabase import Client
from zoneinfo import ZoneInfo

from src.config.types import MatrixConfig, RefreshConfig, RenderConfig
from src.config.multi_sport_types import MultiSportAppConfig, SportFavorites, SportPriorityConfig, FavoriteTeam


@dataclass
class DeviceConfiguration:
    """Complete device configuration from Supabase."""
    device_id: str
    timezone: str
    enabled: bool
    matrix_config: MatrixConfig
    render_config: RenderConfig
    refresh_config: RefreshConfig
    priority_config: SportPriorityConfig
    enabled_leagues: List[str]
    favorite_teams: Dict[str, List[str]]  # league_code -> team_ids
    last_updated: datetime


class SupabaseConfigLoader:
    """
    Loads device configuration directly from Supabase.
    No websockets, no agents, just simple polling.
    """

    def __init__(self, device_id: str, supabase_client: Client):
        """
        Initialize the config loader.

        Args:
            device_id: UUID of the device
            supabase_client: Initialized Supabase client
        """
        self.device_id = device_id
        self.client = supabase_client
        self._last_updated: Optional[datetime] = None
        self._cached_config: Optional[DeviceConfiguration] = None
        self._last_heartbeat: Optional[datetime] = None

    def load_full_config(self) -> DeviceConfiguration:
        """
        Load complete configuration from Supabase.

        Returns:
            DeviceConfiguration with all settings
        """
        try:
            # 1. Load main device config
            response = (
                self.client.table('device_config')
                .select('*')
                .eq('device_id', self.device_id)
                .single()
                .execute()
            )

            if not response.data:
                # Create default config if none exists
                return self._create_default_config()

            config_data = response.data

            # 2. Load enabled leagues
            leagues_response = (
                self.client.table('device_leagues')
                .select('league:leagues(code), priority')
                .eq('device_id', self.device_id)
                .eq('enabled', True)
                .order('priority')
                .execute()
            )

            enabled_leagues = [
                item['league']['code']
                for item in leagues_response.data
                if item.get('league', {}).get('code')
            ]

            # 3. Load favorite teams grouped by league
            favorites_response = (
                self.client.table('device_favorite_teams')
                .select('team_id, league:leagues(code), priority')
                .eq('device_id', self.device_id)
                .order('priority')
                .execute()
            )

            # Group favorites by league
            favorite_teams: Dict[str, List[str]] = {}
            for item in favorites_response.data:
                league_code = item.get('league', {}).get('code')
                if league_code:
                    if league_code not in favorite_teams:
                        favorite_teams[league_code] = []
                    favorite_teams[league_code].append(item['team_id'])

            # 4. Parse configuration into objects
            matrix_config = MatrixConfig(**config_data.get('matrix_config', {}))
            render_config = RenderConfig(**config_data.get('render_config', {}))
            refresh_config = RefreshConfig(**config_data.get('refresh_config', {}))

            # Parse priority config
            priority_data = config_data.get('priority_config', {})
            priority_config = SportPriorityConfig(
                conflict_resolution=priority_data.get('conflict_resolution', 'priority'),
                live_game_boost=priority_data.get('live_game_boost', True),
                favorite_team_boost=priority_data.get('favorite_team_boost', True),
                close_game_boost=priority_data.get('close_game_boost', True),
                playoff_boost=priority_data.get('playoff_boost', True),
                manual_override_duration_minutes=priority_data.get('manual_override_duration_minutes', 60),
                auto_clear_override_on_game_end=priority_data.get('auto_clear_override_on_game_end', True),
            )

            # 5. Build complete configuration
            device_config = DeviceConfiguration(
                device_id=self.device_id,
                timezone=config_data.get('timezone', 'America/Los_Angeles'),
                enabled=config_data.get('enabled', True),
                matrix_config=matrix_config,
                render_config=render_config,
                refresh_config=refresh_config,
                priority_config=priority_config,
                enabled_leagues=enabled_leagues,
                favorite_teams=favorite_teams,
                last_updated=datetime.now()
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

        return DeviceConfiguration(
            device_id=self.device_id,
            timezone='America/Los_Angeles',
            enabled=True,
            matrix_config=MatrixConfig(),
            render_config=RenderConfig(),
            refresh_config=RefreshConfig(),
            priority_config=SportPriorityConfig(),
            enabled_leagues=['wnba', 'nhl'],
            favorite_teams={},
            last_updated=datetime.now()
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
        """Update the device's last_seen_at timestamp."""
        # Only send heartbeat every 5 minutes to reduce DB writes
        if self._last_heartbeat:
            elapsed = (datetime.now() - self._last_heartbeat).total_seconds()
            if elapsed < 300:  # 5 minutes
                return

        try:
            self.client.table('device_config').update({
                'last_seen_at': datetime.now().isoformat()
            }).eq('device_id', self.device_id).execute()

            self._last_heartbeat = datetime.now()
            print(f"[debug] Heartbeat sent for device {self.device_id}")
        except Exception as e:
            print(f"[warning] Failed to update heartbeat: {e}")

    def to_legacy_config(self, device_config: DeviceConfiguration) -> MultiSportAppConfig:
        """
        Convert DeviceConfiguration to legacy MultiSportAppConfig format.
        This maintains compatibility with existing renderer code.
        """
        # Build sports list from enabled leagues and favorites
        sports = []
        sport_priorities = device_config.priority_config.__dict__.get('sport_order', ['wnba', 'nhl', 'nba'])

        for idx, league_code in enumerate(sport_priorities):
            enabled = league_code in device_config.enabled_leagues
            favorites = device_config.favorite_teams.get(league_code, [])

            # Convert team IDs to FavoriteTeam objects
            # For now, use team_id as all fields until we load full team data
            favorite_teams = [
                FavoriteTeam(id=team_id, abbr=team_id, name=team_id)
                for team_id in favorites
            ]

            sport_config = SportFavorites(
                sport=league_code,
                enabled=enabled,
                priority=idx + 1,
                teams=favorite_teams
            )
            sports.append(sport_config)

        # Get timezone object
        try:
            tz = ZoneInfo(device_config.timezone)
        except Exception:
            tz = ZoneInfo('America/Los_Angeles')

        return MultiSportAppConfig(
            sports=sports,
            sport_priority=device_config.priority_config,
            timezone=device_config.timezone,
            tz=tz,
            matrix=device_config.matrix_config,
            refresh=device_config.refresh_config,
            render=device_config.render_config
        )

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