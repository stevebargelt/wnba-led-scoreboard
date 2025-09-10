"""
Adaptive refresh rate manager that adjusts polling based on game state and network conditions.
"""

import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, Dict, Any

from src.config.types import RefreshConfig
from src.model.game import GameSnapshot, GameState


class NetworkCondition(Enum):
    EXCELLENT = "excellent"  # No failures
    GOOD = "good"           # Occasional failures
    POOR = "poor"           # Frequent failures
    CRITICAL = "critical"   # Very frequent failures


class AdaptiveRefreshManager:
    """Manages adaptive refresh rates based on game state and network conditions."""
    
    def __init__(self, base_config: RefreshConfig):
        self.base_config = base_config
        
        # Network condition tracking
        self._request_count = 0
        self._failure_count = 0
        self._last_failure_time = 0.0
        self._network_condition = NetworkCondition.EXCELLENT
        
        # Game state tracking
        self._last_game_snapshot: Optional[GameSnapshot] = None
        self._last_score_change_time = 0.0
        self._consecutive_no_change_count = 0
        
        # Adaptive factors
        self._network_multipliers = {
            NetworkCondition.EXCELLENT: 1.0,
            NetworkCondition.GOOD: 1.2,
            NetworkCondition.POOR: 1.5,
            NetworkCondition.CRITICAL: 2.0,
        }
        
    def record_request_success(self) -> None:
        """Record a successful API request."""
        self._request_count += 1
        self._update_network_condition()
        
    def record_request_failure(self) -> None:
        """Record a failed API request."""
        self._request_count += 1
        self._failure_count += 1
        self._last_failure_time = time.time()
        self._update_network_condition()
        
    def get_refresh_interval(
        self,
        snapshot: Optional[GameSnapshot],
        current_time: datetime,
        force_base_rate: bool = False
    ) -> int:
        """
        Get adaptive refresh interval based on current conditions.
        
        Args:
            snapshot: Current game snapshot (None if no games)
            current_time: Current local time
            force_base_rate: If True, ignore adaptations and use base rate
            
        Returns:
            Refresh interval in seconds
        """
        if force_base_rate:
            return self._get_base_refresh_interval(snapshot)
        
        base_interval = self._get_base_refresh_interval(snapshot)
        
        # Apply network condition multiplier
        network_multiplier = self._network_multipliers[self._network_condition]
        adapted_interval = base_interval * network_multiplier
        
        # Apply game-specific adaptations
        if snapshot:
            game_multiplier = self._get_game_state_multiplier(snapshot, current_time)
            adapted_interval *= game_multiplier
            
            # Update game tracking
            self._update_game_tracking(snapshot)
        
        # Ensure reasonable bounds
        adapted_interval = max(5, min(300, adapted_interval))  # 5 seconds to 5 minutes
        
        return int(adapted_interval)
    
    def _get_base_refresh_interval(self, snapshot: Optional[GameSnapshot]) -> int:
        """Get base refresh interval from configuration."""
        if snapshot is None:
            return max(30, self.base_config.final_sec)  # No games = use final_sec or 30s minimum
        
        if snapshot.state == GameState.PRE:
            return self.base_config.pregame_sec
        elif snapshot.state == GameState.LIVE:
            return self.base_config.ingame_sec
        else:  # FINAL
            return self.base_config.final_sec
    
    def _get_game_state_multiplier(self, snapshot: GameSnapshot, current_time: datetime) -> float:
        """Get multiplier based on specific game conditions."""
        multiplier = 1.0
        
        if snapshot.state == GameState.PRE:
            # Faster refresh as game approaches
            if 0 <= snapshot.seconds_to_start <= 300:  # 5 minutes before
                multiplier = 0.5  # 2x faster
            elif 0 <= snapshot.seconds_to_start <= 600:  # 10 minutes before
                multiplier = 0.7  # ~1.4x faster
            elif snapshot.seconds_to_start > 3600:  # More than 1 hour
                multiplier = 2.0  # 2x slower
                
        elif snapshot.state == GameState.LIVE:
            # Check if game appears to be in intermission/timeout
            if self._is_likely_intermission(snapshot):
                multiplier = 1.5  # Slower during breaks
            elif self._has_recent_score_change():
                multiplier = 0.8  # Faster when action is happening
            elif self._consecutive_no_change_count > 5:
                multiplier = 1.3  # Slower if nothing changing for a while
                
        elif snapshot.state == GameState.FINAL:
            # Slow down refresh for completed games
            hours_since_end = self._estimate_hours_since_game_end(snapshot, current_time)
            if hours_since_end > 2:
                multiplier = 2.0  # Much slower for old completed games
            elif hours_since_end > 1:
                multiplier = 1.5
                
        return multiplier
    
    def _update_network_condition(self) -> None:
        """Update network condition assessment."""
        if self._request_count < 3:
            # Not enough data yet
            return
        
        failure_rate = self._failure_count / self._request_count
        recent_failure = time.time() - self._last_failure_time < 300  # 5 minutes
        
        if failure_rate == 0:
            self._network_condition = NetworkCondition.EXCELLENT
        elif failure_rate < 0.1:
            self._network_condition = NetworkCondition.GOOD
        elif failure_rate < 0.3:
            self._network_condition = NetworkCondition.POOR
        else:
            self._network_condition = NetworkCondition.CRITICAL
            
        # Recent failures bump up the severity
        if recent_failure and self._network_condition in [NetworkCondition.EXCELLENT, NetworkCondition.GOOD]:
            self._network_condition = NetworkCondition.GOOD if self._network_condition == NetworkCondition.EXCELLENT else NetworkCondition.POOR
    
    def _update_game_tracking(self, snapshot: GameSnapshot) -> None:
        """Update game state tracking for change detection."""
        if self._last_game_snapshot is None:
            self._last_game_snapshot = snapshot
            return
        
        # Check for score changes
        last_total_score = self._last_game_snapshot.home.score + self._last_game_snapshot.away.score
        current_total_score = snapshot.home.score + snapshot.away.score
        
        if current_total_score != last_total_score:
            self._last_score_change_time = time.time()
            self._consecutive_no_change_count = 0
        else:
            self._consecutive_no_change_count += 1
            
        self._last_game_snapshot = snapshot
    
    def _is_likely_intermission(self, snapshot: GameSnapshot) -> bool:
        """Detect if game is likely in intermission/timeout."""
        # Look for clock patterns that suggest breaks
        clock = snapshot.display_clock.lower()
        
        # Common intermission indicators
        intermission_indicators = [
            "halftime", "end", "intermission", "timeout",
            "break", "commercial", "review"
        ]
        
        return any(indicator in clock for indicator in intermission_indicators)
    
    def _has_recent_score_change(self) -> bool:
        """Check if there was a recent score change."""
        return time.time() - self._last_score_change_time < 120  # 2 minutes
    
    def _estimate_hours_since_game_end(self, snapshot: GameSnapshot, current_time: datetime) -> float:
        """Estimate hours since game ended (rough approximation)."""
        # This is approximate - we don't have exact end time
        # Assume game lasted about 2.5 hours from start
        estimated_end = snapshot.start_time_local.replace(tzinfo=current_time.tzinfo) + \
                       timedelta(hours=2.5)
        delta = current_time - estimated_end
        return max(0, delta.total_seconds() / 3600)
    
    def get_status(self) -> Dict[str, Any]:
        """Get current status information."""
        failure_rate = (self._failure_count / self._request_count) if self._request_count > 0 else 0
        
        return {
            "network_condition": self._network_condition.value,
            "request_count": self._request_count,
            "failure_count": self._failure_count,
            "failure_rate": round(failure_rate, 3),
            "consecutive_no_change": self._consecutive_no_change_count,
            "last_score_change_ago_sec": time.time() - self._last_score_change_time if self._last_score_change_time > 0 else None,
        }
    
    def reset_stats(self) -> None:
        """Reset network statistics (useful for testing or after config changes)."""
        self._request_count = 0
        self._failure_count = 0
        self._last_failure_time = 0.0
        self._network_condition = NetworkCondition.EXCELLENT
        self._consecutive_no_change_count = 0