"""Tests for StateManager class."""

import unittest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from src.boards.state import StateManager, BoardState, BoardRotation


class TestStateManager(unittest.TestCase):
    """Test StateManager functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.manager = StateManager()

    def test_initialization(self):
        """Test StateManager initialization."""
        self.assertEqual(self.manager.current_state, BoardState.IDLE)
        self.assertEqual(self.manager.previous_state, BoardState.IDLE)
        self.assertEqual(self.manager.board_rotation_index, 0)
        self.assertIsNotNone(self.manager.rotations)
        self.assertEqual(len(self.manager.transition_history), 0)

    def test_determine_state_no_game(self):
        """Test state determination with no game."""
        context = {'game_snapshot': None, 'current_time': datetime.now()}
        state = self.manager.determine_state(context)
        self.assertEqual(state, BoardState.IDLE)

    def test_determine_state_pregame(self):
        """Test state determination for pregame."""
        # Create mock game starting in 20 minutes
        game = Mock()
        game.state = 'pre'
        game.start_time_local = datetime.now() + timedelta(minutes=20)

        context = {
            'game_snapshot': game,
            'current_time': datetime.now()
        }

        state = self.manager.determine_state(context)
        self.assertEqual(state, BoardState.PREGAME)

    def test_determine_state_pregame_too_far(self):
        """Test pregame state not triggered if game too far in future."""
        # Create mock game starting in 2 hours
        game = Mock()
        game.state = 'pre'
        game.start_time_local = datetime.now() + timedelta(hours=2)

        context = {
            'game_snapshot': game,
            'current_time': datetime.now()
        }

        state = self.manager.determine_state(context)
        self.assertEqual(state, BoardState.IDLE)

    def test_determine_state_live(self):
        """Test state determination for live game."""
        game = Mock()
        game.state = 'live'
        game.is_intermission = False

        context = {
            'game_snapshot': game,
            'current_time': datetime.now()
        }

        state = self.manager.determine_state(context)
        self.assertEqual(state, BoardState.LIVE)

    def test_determine_state_intermission(self):
        """Test state determination for intermission."""
        game = Mock()
        game.state = 'live'
        game.is_intermission = True

        context = {
            'game_snapshot': game,
            'current_time': datetime.now()
        }

        state = self.manager.determine_state(context)
        self.assertEqual(state, BoardState.INTERMISSION)

    def test_determine_state_postgame(self):
        """Test state determination for postgame."""
        game = Mock()
        game.state = 'final'
        # Mock doesn't have end_time by default, which causes the error
        game.end_time = None  # Set to None to test the fallback path

        context = {
            'game_snapshot': game,
            'current_time': datetime.now()
        }

        state = self.manager.determine_state(context)
        self.assertEqual(state, BoardState.POSTGAME)

    def test_update_state_change(self):
        """Test state update when state changes."""
        self.manager.current_state = BoardState.IDLE

        result = self.manager.update_state(BoardState.PREGAME)
        self.assertTrue(result)
        self.assertEqual(self.manager.current_state, BoardState.PREGAME)
        self.assertEqual(self.manager.previous_state, BoardState.IDLE)
        self.assertEqual(self.manager.board_rotation_index, 0)

    def test_update_state_no_change(self):
        """Test state update when state doesn't change."""
        self.manager.current_state = BoardState.LIVE

        result = self.manager.update_state(BoardState.LIVE)
        self.assertFalse(result)
        self.assertEqual(self.manager.current_state, BoardState.LIVE)

    def test_get_current_board_sequence(self):
        """Test getting board sequence for current state."""
        self.manager.current_state = BoardState.IDLE

        sequence = self.manager.get_current_board_sequence()
        self.assertEqual(sequence, ['clock', 'standings', 'schedule'])

        # Test with disabled rotation
        self.manager.disable_rotation(BoardState.IDLE)
        sequence = self.manager.get_current_board_sequence()
        self.assertEqual(sequence, [])

    def test_get_next_board_in_rotation_no_rotation(self):
        """Test board rotation when there's no rotation."""
        self.manager.current_state = BoardState.LIVE

        # LIVE state only has scoreboard, no rotation
        board = self.manager.get_next_board_in_rotation()
        self.assertEqual(board, 'scoreboard')

    def test_get_next_board_in_rotation_with_timing(self):
        """Test board rotation with timing."""
        self.manager.current_state = BoardState.IDLE
        self.manager.board_rotation_index = 0
        self.manager.last_rotation_time = datetime.now()

        # First call should return first board
        board = self.manager.get_next_board_in_rotation()
        self.assertEqual(board, 'clock')

        # After enough time, should rotate
        self.manager.last_rotation_time = datetime.now() - timedelta(seconds=31)
        board = self.manager.get_next_board_in_rotation()
        # Should have rotated to next board
        self.assertEqual(self.manager.board_rotation_index, 1)
        self.assertEqual(board, 'standings')

    def test_should_force_board_live_scoreboard(self):
        """Test forcing scoreboard during live state."""
        self.manager.current_state = BoardState.LIVE

        # Should force scoreboard during live
        self.assertTrue(self.manager.should_force_board('scoreboard_hockey'))
        self.assertTrue(self.manager.should_force_board('scoreboard_basketball'))

        # Should not force other boards
        self.assertFalse(self.manager.should_force_board('clock'))

    def test_should_force_board_alert(self):
        """Test forcing alert board during alert state."""
        self.manager.current_state = BoardState.ALERT

        self.assertTrue(self.manager.should_force_board('alert'))
        self.assertFalse(self.manager.should_force_board('scoreboard'))

    def test_record_transition(self):
        """Test recording board transitions."""
        self.manager.record_transition('clock', 'scoreboard', 'fade')

        self.assertEqual(len(self.manager.transition_history), 1)
        transition = self.manager.transition_history[0]
        self.assertEqual(transition.from_board, 'clock')
        self.assertEqual(transition.to_board, 'scoreboard')
        self.assertEqual(transition.transition_type, 'fade')

    def test_transition_history_limit(self):
        """Test that transition history is limited."""
        # Record 150 transitions
        for i in range(150):
            self.manager.record_transition(f'board{i}', f'board{i+1}')

        # Should only keep last 100
        self.assertEqual(len(self.manager.transition_history), 100)

    def test_get_state_duration(self):
        """Test getting duration in current state."""
        self.manager.state_start_time = datetime.now() - timedelta(seconds=30)

        duration = self.manager.get_state_duration()
        self.assertAlmostEqual(duration, 30, delta=1)

    def test_configure_rotation(self):
        """Test configuring rotation for a state."""
        self.manager.configure_rotation(
            BoardState.PREGAME,
            boards=['scoreboard', 'news', 'weather'],
            cycle_duration=120
        )

        rotation = self.manager.rotations[BoardState.PREGAME]
        self.assertEqual(rotation.boards, ['scoreboard', 'news', 'weather'])
        self.assertEqual(rotation.cycle_duration, 120)
        self.assertTrue(rotation.enabled)

    def test_disable_enable_rotation(self):
        """Test disabling and enabling rotation."""
        self.manager.disable_rotation(BoardState.IDLE)
        self.assertFalse(self.manager.rotations[BoardState.IDLE].enabled)

        self.manager.enable_rotation(BoardState.IDLE)
        self.assertTrue(self.manager.rotations[BoardState.IDLE].enabled)

    def test_reset(self):
        """Test resetting state manager."""
        # Set some state
        self.manager.current_state = BoardState.LIVE
        self.manager.previous_state = BoardState.PREGAME
        self.manager.board_rotation_index = 2
        self.manager.record_transition('a', 'b')

        # Reset
        self.manager.reset()

        self.assertEqual(self.manager.current_state, BoardState.IDLE)
        self.assertEqual(self.manager.previous_state, BoardState.IDLE)
        self.assertEqual(self.manager.board_rotation_index, 0)
        self.assertEqual(len(self.manager.transition_history), 0)

    def test_rotation_wrapping(self):
        """Test that rotation index wraps around."""
        self.manager.current_state = BoardState.IDLE
        self.manager.board_rotation_index = 2  # Last board
        self.manager.last_rotation_time = datetime.now() - timedelta(seconds=31)

        # Should wrap back to 0
        board = self.manager.get_next_board_in_rotation()
        self.assertEqual(self.manager.board_rotation_index, 0)
        self.assertEqual(board, 'clock')


if __name__ == '__main__':
    unittest.main()