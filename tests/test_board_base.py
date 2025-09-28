"""Tests for BoardBase abstract class and inheritance."""

import unittest
from unittest.mock import Mock, MagicMock
from PIL import Image, ImageDraw
from typing import Dict, Any

from src.boards.base import BoardBase


class TestBoardBase(unittest.TestCase):
    """Test BoardBase abstract class."""

    def setUp(self):
        """Set up test fixtures."""
        self.config = {
            'enabled': True,
            'priority': 50,
            'duration': 10,
            'refresh_rate': 2.0
        }

        # Create a concrete implementation for testing
        class TestBoard(BoardBase):
            def render(self, buffer, draw, context):
                draw.text((0, 0), "Test", fill=(255, 255, 255))

            def should_display(self, context):
                return context.get('test_mode', False)

        self.TestBoard = TestBoard
        self.board = TestBoard(self.config)

    def test_initialization(self):
        """Test board initialization with config."""
        self.assertTrue(self.board.enabled)
        self.assertEqual(self.board.priority, 50)
        self.assertEqual(self.board.duration, 10)
        self.assertEqual(self.board.name, 'TestBoard')

    def test_default_config_values(self):
        """Test default values when config is minimal."""
        minimal_board = self.TestBoard({})
        self.assertTrue(minimal_board.enabled)
        self.assertEqual(minimal_board.priority, 0)
        self.assertEqual(minimal_board.duration, 10)

    def test_should_display(self):
        """Test should_display logic."""
        # Should not display without test_mode
        context = {'test_mode': False}
        self.assertFalse(self.board.should_display(context))

        # Should display with test_mode
        context = {'test_mode': True}
        self.assertTrue(self.board.should_display(context))

    def test_render_called(self):
        """Test that render method is called properly."""
        buffer = Image.new('RGB', (64, 32))
        draw = ImageDraw.Draw(buffer)
        context = {'test_mode': True}

        # Should not raise exception
        self.board.render(buffer, draw, context)

    def test_lifecycle_methods(self):
        """Test on_enter and on_exit methods."""
        # These should not raise exceptions
        self.board.on_enter()
        self.board.on_exit()

    def test_update_method(self):
        """Test update method."""
        context = {'test_mode': True, 'data': 'test'}
        # Should not raise exception
        self.board.update(context)

    def test_handle_input(self):
        """Test handle_input returns False by default."""
        result = self.board.handle_input('button_press', 'up')
        self.assertFalse(result)

    def test_get_refresh_rate(self):
        """Test refresh rate retrieval."""
        self.assertEqual(self.board.get_refresh_rate(), 2.0)

        # Test default when not specified
        board2 = self.TestBoard({'enabled': True})
        self.assertEqual(board2.get_refresh_rate(), 1.0)

    def test_string_representations(self):
        """Test __str__ and __repr__ methods."""
        str_repr = str(self.board)
        self.assertIn('TestBoard', str_repr)
        self.assertIn('priority=50', str_repr)
        self.assertIn('enabled=True', str_repr)

        repr_str = repr(self.board)
        self.assertIn('TestBoard', repr_str)
        self.assertIn('priority=50', repr_str)

    def test_disabled_board(self):
        """Test disabled board behavior."""
        config = {'enabled': False, 'priority': 100}
        board = self.TestBoard(config)
        self.assertFalse(board.enabled)


class TestBoardInheritance(unittest.TestCase):
    """Test that boards properly inherit from BoardBase."""

    def test_multiple_inheritance_levels(self):
        """Test inheritance with multiple levels."""
        from src.boards.builtins.scoreboard.base import BaseScoreboardBoard

        # BaseScoreboardBoard should inherit from BoardBase
        self.assertTrue(issubclass(BaseScoreboardBoard, BoardBase))

        # Sport-specific boards should inherit from BaseScoreboardBoard
        from src.boards.builtins.scoreboard.hockey import HockeyScoreboardBoard
        self.assertTrue(issubclass(HockeyScoreboardBoard, BaseScoreboardBoard))
        self.assertTrue(issubclass(HockeyScoreboardBoard, BoardBase))

    def test_clock_board_inheritance(self):
        """Test ClockBoard inherits from BoardBase."""
        from src.boards.builtins.clock import ClockBoard
        self.assertTrue(issubclass(ClockBoard, BoardBase))


if __name__ == '__main__':
    unittest.main()