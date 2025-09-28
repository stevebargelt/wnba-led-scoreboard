"""
Board state management and transitions.
"""

from enum import Enum
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta


class BoardState(Enum):
    """Possible board display states."""
    IDLE = "idle"
    PREGAME = "pregame"
    LIVE = "live"
    INTERMISSION = "intermission"
    POSTGAME = "postgame"
    ALERT = "alert"
    MANUAL = "manual"  # Manual override active


@dataclass
class BoardRotation:
    """Configuration for board rotation in a given state."""
    state: BoardState
    boards: List[str]  # Board names to rotate through
    cycle_duration: int = 60  # Total seconds to cycle through all boards
    enabled: bool = True


@dataclass
class BoardTransition:
    """Represents a transition between boards."""
    from_board: str
    to_board: str
    transition_type: str = "cut"  # cut, fade, slide, etc.
    duration_ms: int = 0  # Transition duration in milliseconds
    timestamp: datetime = field(default_factory=datetime.now)


class StateManager:
    """Manages board state transitions and rotation sequences."""

    def __init__(self):
        """Initialize state manager."""
        self.current_state = BoardState.IDLE
        self.previous_state = BoardState.IDLE
        self.state_start_time = datetime.now()
        self.board_rotation_index = 0
        self.last_rotation_time = datetime.now()

        # Default rotation sequences for each state
        self.rotations: Dict[BoardState, BoardRotation] = {
            BoardState.IDLE: BoardRotation(
                state=BoardState.IDLE,
                boards=['clock', 'standings', 'schedule'],
                cycle_duration=90,  # 30 seconds each
            ),
            BoardState.PREGAME: BoardRotation(
                state=BoardState.PREGAME,
                boards=['scoreboard', 'team_stats', 'standings'],
                cycle_duration=60,  # 20 seconds each
            ),
            BoardState.LIVE: BoardRotation(
                state=BoardState.LIVE,
                boards=['scoreboard'],  # Only show scoreboard during live games
                cycle_duration=0,  # No rotation
            ),
            BoardState.INTERMISSION: BoardRotation(
                state=BoardState.INTERMISSION,
                boards=['scoreboard', 'standings', 'team_stats'],
                cycle_duration=90,
            ),
            BoardState.POSTGAME: BoardRotation(
                state=BoardState.POSTGAME,
                boards=['scoreboard', 'standings', 'schedule'],
                cycle_duration=120,  # 40 seconds each
            ),
            BoardState.ALERT: BoardRotation(
                state=BoardState.ALERT,
                boards=['alert'],  # Special alert board
                cycle_duration=0,
            ),
            BoardState.MANUAL: BoardRotation(
                state=BoardState.MANUAL,
                boards=[],  # Will be set manually
                cycle_duration=0,
            ),
        }

        # Transition history
        self.transition_history: List[BoardTransition] = []

    def determine_state(self, context: Dict[str, Any]) -> BoardState:
        """
        Determine the appropriate board state based on context.

        Args:
            context: Runtime context with game info

        Returns:
            Appropriate BoardState
        """
        game_snapshot = context.get('game_snapshot')

        # No game = idle
        if not game_snapshot:
            return BoardState.IDLE

        # Check game state
        game_state = str(game_snapshot.state).lower()

        if game_state == 'pre':
            # Check if game is starting soon (within 30 minutes)
            now = context.get('current_time', datetime.now())
            if hasattr(game_snapshot, 'start_time_local'):
                time_to_start = (game_snapshot.start_time_local - now).total_seconds()
                if 0 < time_to_start < 1800:  # 30 minutes
                    return BoardState.PREGAME
            return BoardState.IDLE

        elif game_state == 'live':
            # Check if intermission (for sports that have them)
            if hasattr(game_snapshot, 'is_intermission') and game_snapshot.is_intermission:
                return BoardState.INTERMISSION
            return BoardState.LIVE

        elif game_state in ['final', 'end', 'post']:
            # Show postgame for a while after game ends
            if hasattr(game_snapshot, 'end_time'):
                time_since_end = (datetime.now() - game_snapshot.end_time).total_seconds()
                if time_since_end < 3600:  # Show postgame for 1 hour
                    return BoardState.POSTGAME
            else:
                # No end time, show postgame for a bit anyway
                return BoardState.POSTGAME

        # Default to idle
        return BoardState.IDLE

    def update_state(self, new_state: BoardState) -> bool:
        """
        Update the current state.

        Args:
            new_state: New board state

        Returns:
            True if state changed, False otherwise
        """
        if new_state != self.current_state:
            self.previous_state = self.current_state
            self.current_state = new_state
            self.state_start_time = datetime.now()
            self.board_rotation_index = 0
            self.last_rotation_time = datetime.now()
            return True
        return False

    def get_current_board_sequence(self) -> List[str]:
        """
        Get the board sequence for the current state.

        Returns:
            List of board names to rotate through
        """
        rotation = self.rotations.get(self.current_state)
        if rotation and rotation.enabled:
            return rotation.boards
        return []

    def get_next_board_in_rotation(self) -> Optional[str]:
        """
        Get the next board in the rotation sequence.

        Returns:
            Board name or None if no rotation
        """
        boards = self.get_current_board_sequence()
        if not boards:
            return None

        # Check if it's time to rotate
        rotation = self.rotations[self.current_state]
        if rotation.cycle_duration > 0 and len(boards) > 1:
            time_per_board = rotation.cycle_duration / len(boards)
            time_since_rotation = (datetime.now() - self.last_rotation_time).total_seconds()

            if time_since_rotation >= time_per_board:
                # Time to rotate
                self.board_rotation_index = (self.board_rotation_index + 1) % len(boards)
                self.last_rotation_time = datetime.now()

        return boards[self.board_rotation_index] if boards else None

    def should_force_board(self, board_name: str) -> bool:
        """
        Check if a specific board should be forced in current state.

        Args:
            board_name: Name of the board

        Returns:
            True if board should be forced
        """
        # During LIVE state, always force scoreboard
        if self.current_state == BoardState.LIVE and board_name.startswith('scoreboard'):
            return True

        # During ALERT state, force alert board
        if self.current_state == BoardState.ALERT and board_name == 'alert':
            return True

        return False

    def record_transition(self,
                         from_board: str,
                         to_board: str,
                         transition_type: str = "cut") -> None:
        """
        Record a board transition.

        Args:
            from_board: Board transitioning from
            to_board: Board transitioning to
            transition_type: Type of transition
        """
        transition = BoardTransition(
            from_board=from_board,
            to_board=to_board,
            transition_type=transition_type,
            timestamp=datetime.now()
        )
        self.transition_history.append(transition)

        # Keep history limited to last 100 transitions
        if len(self.transition_history) > 100:
            self.transition_history = self.transition_history[-100:]

    def get_state_duration(self) -> float:
        """
        Get how long we've been in the current state.

        Returns:
            Duration in seconds
        """
        return (datetime.now() - self.state_start_time).total_seconds()

    def configure_rotation(self,
                          state: BoardState,
                          boards: List[str],
                          cycle_duration: int) -> None:
        """
        Configure board rotation for a specific state.

        Args:
            state: Board state to configure
            boards: List of board names to rotate
            cycle_duration: Total cycle duration in seconds
        """
        self.rotations[state] = BoardRotation(
            state=state,
            boards=boards,
            cycle_duration=cycle_duration,
            enabled=True
        )

    def disable_rotation(self, state: BoardState) -> None:
        """
        Disable rotation for a specific state.

        Args:
            state: Board state to disable rotation for
        """
        if state in self.rotations:
            self.rotations[state].enabled = False

    def enable_rotation(self, state: BoardState) -> None:
        """
        Enable rotation for a specific state.

        Args:
            state: Board state to enable rotation for
        """
        if state in self.rotations:
            self.rotations[state].enabled = True

    def reset(self) -> None:
        """Reset state manager to initial state."""
        self.current_state = BoardState.IDLE
        self.previous_state = BoardState.IDLE
        self.state_start_time = datetime.now()
        self.board_rotation_index = 0
        self.last_rotation_time = datetime.now()
        self.transition_history.clear()