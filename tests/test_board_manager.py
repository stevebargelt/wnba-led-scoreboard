"""Tests for BoardManager class."""

import unittest
from unittest.mock import Mock, MagicMock, patch
from typing import Dict, Any
from PIL import Image, ImageDraw
from datetime import datetime
from zoneinfo import ZoneInfo

from src.boards.manager import BoardManager
from src.boards.base import BoardBase
from src.model.game import GameSnapshot, GameState, TeamInfo


class MockBoard(BoardBase):
    """Mock board for testing."""

    def render(self, buffer, draw, context):
        pass

    def should_display(self, context):
        return True


class TestBoardManager(unittest.TestCase):
    """Test BoardManager functionality."""

    def setUp(self):
        """Set up test fixtures."""
        # Mock device configuration
        self.mock_config = Mock()
        self.mock_config.board_configs = {}
        self.mock_config.render_config = Mock()
        self.mock_config.render_config.logo_variant = 'mini'
        self.mock_config.render_config.live_layout = 'stacked'

        # Patch board loading to avoid loading real boards
        with patch.object(BoardManager, '_load_builtin_boards'):
            with patch.object(BoardManager, '_load_plugin_boards'):
                self.manager = BoardManager(self.mock_config)

        # Add some mock boards
        self.manager.boards['test1'] = MockBoard({'enabled': True, 'priority': 100})
        self.manager.boards['test2'] = MockBoard({'enabled': True, 'priority': 50})
        self.manager.boards['test3'] = MockBoard({'enabled': False, 'priority': 75})

    def test_initialization(self):
        """Test BoardManager initialization."""
        self.assertIsNotNone(self.manager.state_manager)
        self.assertIsNone(self.manager.current_board)
        self.assertEqual(len(self.manager.board_history), 0)

    def test_get_next_board_by_priority(self):
        """Test board selection by priority."""
        context = {
            'game_snapshot': None,
            'current_time': datetime.now(),
            'state': 'idle'
        }

        # Should return highest priority enabled board
        board = self.manager.get_next_board(context)
        self.assertEqual(board, self.manager.boards['test1'])

    def test_get_next_board_disabled_ignored(self):
        """Test that disabled boards are not selected."""
        # Disable the high priority board
        self.manager.boards['test1'].enabled = False

        context = {
            'game_snapshot': None,
            'current_time': datetime.now(),
            'state': 'idle'
        }

        # Should skip disabled board and return next highest
        board = self.manager.get_next_board(context)
        self.assertEqual(board, self.manager.boards['test2'])

    def test_get_next_board_with_game_snapshot(self):
        """Test board selection with game snapshot."""
        # Create mock game snapshot
        sport = Mock()
        sport.name = "Hockey"
        sport.code = "hockey"

        league = Mock()
        league.name = "NHL"
        league.code = "nhl"

        game = GameSnapshot(
            sport=sport,
            league=league,
            event_id="test123",
            start_time_local=datetime.now(),
            state=GameState.LIVE,
            home=TeamInfo(id="1", name="Home", abbr="HOM", score=3),
            away=TeamInfo(id="2", name="Away", abbr="AWY", score=2),
            current_period=2,
            period_name="2nd",
            display_clock="12:34"
        )

        # Add sport-specific scoreboard
        hockey_board = MockBoard({'enabled': True, 'priority': 150})
        hockey_board.should_display = Mock(return_value=True)
        self.manager.boards['scoreboard_hockey'] = hockey_board

        context = {
            'game_snapshot': game,
            'current_time': datetime.now(),
            'state': 'live'
        }

        # Should select sport-specific scoreboard
        board = self.manager.get_next_board(context)
        self.assertEqual(board, hockey_board)

    def test_transition_to(self):
        """Test board transition."""
        board1 = self.manager.boards['test1']
        board2 = self.manager.boards['test2']

        # Mock lifecycle methods
        board1.on_exit = Mock()
        board1.on_enter = Mock()
        board2.on_exit = Mock()
        board2.on_enter = Mock()

        # First transition
        self.manager.transition_to(board1)
        board1.on_enter.assert_called_once()
        self.assertEqual(self.manager.current_board, board1)

        # Transition to different board
        self.manager.transition_to(board2)
        board1.on_exit.assert_called_once()
        board2.on_enter.assert_called_once()
        self.assertEqual(self.manager.current_board, board2)
        self.assertIn('MockBoard', self.manager.board_history)

    def test_transition_to_same_board(self):
        """Test transitioning to the same board (should not trigger lifecycle)."""
        board = self.manager.boards['test1']
        board.on_exit = Mock()
        board.on_enter = Mock()

        # First transition
        self.manager.transition_to(board)
        self.assertEqual(board.on_enter.call_count, 1)

        # Transition to same board
        self.manager.transition_to(board)
        # Should not call on_exit or on_enter again
        self.assertEqual(board.on_exit.call_count, 0)
        self.assertEqual(board.on_enter.call_count, 1)

    def test_handle_interrupt(self):
        """Test interrupt handling."""
        board = self.manager.boards['test1']
        board.handle_input = Mock(return_value=True)
        self.manager.current_board = board

        # Test input handled by board
        self.manager.handle_interrupt('button_press', 'up')
        board.handle_input.assert_called_with('button_press', 'up')

        # Test force board interrupt
        board.handle_input.return_value = False
        self.manager.handle_interrupt('force_board', 'test2')
        # Should queue the board name
        self.assertFalse(self.manager.interrupts.empty())
        self.assertEqual(self.manager.interrupts.get(), 'test2')

    def test_render_current(self):
        """Test rendering current board."""
        board = self.manager.boards['test1']
        board.update = Mock()
        board.render = Mock()
        self.manager.current_board = board
        self.manager._last_context = {'test': True}

        buffer = Image.new('RGB', (64, 32))
        draw = ImageDraw.Draw(buffer)

        self.manager.render_current(buffer, draw)
        board.update.assert_called_with({'test': True})
        board.render.assert_called_with(buffer, draw, {'test': True})

    def test_render_current_no_board(self):
        """Test rendering with no current board."""
        buffer = Image.new('RGB', (64, 32))
        draw = ImageDraw.Draw(buffer)

        # Should not raise exception
        self.manager.render_current(buffer, draw)

    def test_get_current_refresh_rate(self):
        """Test getting refresh rate from current board."""
        board = self.manager.boards['test1']
        board.get_refresh_rate = Mock(return_value=5.0)
        self.manager.current_board = board

        rate = self.manager.get_current_refresh_rate()
        self.assertEqual(rate, 5.0)

    def test_get_current_refresh_rate_no_board(self):
        """Test refresh rate with no current board."""
        self.manager.current_board = None
        rate = self.manager.get_current_refresh_rate()
        self.assertEqual(rate, 10.0)  # Default

    def test_should_display_filtering(self):
        """Test that boards are filtered by should_display."""
        # Make test1 not want to display
        self.manager.boards['test1'].should_display = Mock(return_value=False)
        self.manager.boards['test2'].should_display = Mock(return_value=True)

        context = {
            'game_snapshot': None,
            'current_time': datetime.now(),
            'state': 'idle'
        }

        board = self.manager.get_next_board(context)
        # Should skip test1 even though it has higher priority
        self.assertEqual(board, self.manager.boards['test2'])

    def test_interrupt_board_selection(self):
        """Test that interrupts override normal selection."""
        # Queue an interrupt
        self.manager.interrupts.put('test2')

        context = {
            'game_snapshot': None,
            'current_time': datetime.now(),
            'state': 'idle'
        }

        board = self.manager.get_next_board(context)
        # Should return the interrupted board, not highest priority
        self.assertEqual(board, self.manager.boards['test2'])

    def test_state_manager_integration(self):
        """Test state manager is updated during board selection."""
        with patch.object(self.manager.state_manager, 'determine_state') as mock_determine:
            with patch.object(self.manager.state_manager, 'update_state') as mock_update:
                mock_determine.return_value = 'live'
                mock_update.return_value = True  # State changed

                context = {
                    'game_snapshot': None,
                    'current_time': datetime.now(),
                    'state': 'idle'
                }

                self.manager.get_next_board(context)
                mock_determine.assert_called_with(context)
                mock_update.assert_called()


if __name__ == '__main__':
    unittest.main()