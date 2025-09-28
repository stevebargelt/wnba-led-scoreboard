"""Tests for ScoreboardFactory class."""

import unittest
from unittest.mock import Mock, patch

from src.boards.builtins.scoreboard.factory import ScoreboardFactory, GenericScoreboardBoard
from src.boards.builtins.scoreboard.hockey import HockeyScoreboardBoard
from src.boards.builtins.scoreboard.basketball import BasketballScoreboardBoard
from src.boards.builtins.scoreboard.base import BaseScoreboardBoard


class TestScoreboardFactory(unittest.TestCase):
    """Test ScoreboardFactory sport selection."""

    def setUp(self):
        """Set up test fixtures."""
        self.config = {
            'enabled': True,
            'priority': 100,
            'refresh_rate': 2.0,
            'logo_variant': 'mini',
            'live_layout': 'stacked'
        }

    def test_create_hockey_scoreboard(self):
        """Test creating hockey-specific scoreboard."""
        board = ScoreboardFactory.create_scoreboard('hockey', self.config)
        self.assertIsInstance(board, HockeyScoreboardBoard)
        self.assertIsInstance(board, BaseScoreboardBoard)

    def test_create_basketball_scoreboard(self):
        """Test creating basketball-specific scoreboard."""
        board = ScoreboardFactory.create_scoreboard('basketball', self.config)
        self.assertIsInstance(board, BasketballScoreboardBoard)
        self.assertIsInstance(board, BaseScoreboardBoard)

    def test_create_unknown_sport_scoreboard(self):
        """Test creating scoreboard for unknown sport."""
        # Should return generic scoreboard
        board = ScoreboardFactory.create_scoreboard('cricket', self.config)
        self.assertIsInstance(board, GenericScoreboardBoard)
        self.assertIsInstance(board, BaseScoreboardBoard)

    def test_create_with_empty_sport_code(self):
        """Test handling empty sport code."""
        board = ScoreboardFactory.create_scoreboard('', self.config)
        self.assertIsInstance(board, GenericScoreboardBoard)

    def test_get_supported_sports(self):
        """Test getting list of supported sports."""
        sports = ScoreboardFactory.get_supported_sports()
        self.assertIn('hockey', sports)
        self.assertIn('basketball', sports)
        self.assertEqual(len(sports), 2)  # Currently only hockey and basketball

    def test_config_passed_to_board(self):
        """Test that config is properly passed to board."""
        custom_config = {
            'enabled': False,
            'priority': 200,
            'custom_setting': 'test'
        }

        board = ScoreboardFactory.create_scoreboard('hockey', custom_config)
        self.assertFalse(board.enabled)
        self.assertEqual(board.priority, 200)
        self.assertEqual(board.config['custom_setting'], 'test')

    def test_case_sensitivity(self):
        """Test that sport codes are case-sensitive."""
        # Uppercase should not match
        board = ScoreboardFactory.create_scoreboard('HOCKEY', self.config)
        self.assertIsInstance(board, GenericScoreboardBoard)
        self.assertNotIsInstance(board, HockeyScoreboardBoard)

    def test_future_sport_extensibility(self):
        """Test that factory can be extended with new sports."""
        # Mock a new sport board class
        class SoccerScoreboardBoard(BaseScoreboardBoard):
            def _render_pregame(self, buffer, draw, snapshot, context):
                pass
            def _render_live(self, buffer, draw, snapshot, context):
                pass
            def _render_final(self, buffer, draw, snapshot, context):
                pass

        # Add to factory
        original_boards = ScoreboardFactory.SPORT_SCOREBOARDS.copy()
        try:
            ScoreboardFactory.SPORT_SCOREBOARDS['soccer'] = SoccerScoreboardBoard

            # Should now create soccer board
            board = ScoreboardFactory.create_scoreboard('soccer', self.config)
            self.assertIsInstance(board, SoccerScoreboardBoard)

            # Check supported sports includes new sport
            sports = ScoreboardFactory.get_supported_sports()
            self.assertIn('soccer', sports)
        finally:
            # Restore original boards
            ScoreboardFactory.SPORT_SCOREBOARDS = original_boards


class TestGenericScoreboardBoard(unittest.TestCase):
    """Test GenericScoreboardBoard functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.config = {
            'enabled': True,
            'priority': 100,
            'logo_variant': 'mini',
            'live_layout': 'stacked'
        }
        self.board = GenericScoreboardBoard(self.config)

    def test_initialization(self):
        """Test generic board initialization."""
        self.assertTrue(self.board.enabled)
        self.assertEqual(self.board.priority, 100)
        self.assertIsNotNone(self.board._font_small)
        self.assertIsNotNone(self.board._font_large)

    def test_should_display(self):
        """Test should_display for generic board."""
        # Should display with game
        context = {'game_snapshot': Mock()}
        self.assertTrue(self.board.should_display(context))

        # Should not display without game
        context = {'game_snapshot': None}
        self.assertFalse(self.board.should_display(context))

    @patch('src.render.scenes.pregame.draw_pregame')
    def test_render_pregame(self, mock_draw_pregame):
        """Test pregame rendering uses existing function."""
        from PIL import Image, ImageDraw
        from datetime import datetime

        buffer = Image.new('RGB', (64, 32))
        draw = ImageDraw.Draw(buffer)
        snapshot = Mock()
        context = {'current_time': datetime.now()}

        self.board._render_pregame(buffer, draw, snapshot, context)
        mock_draw_pregame.assert_called_once()

    @patch('src.render.scenes.live.draw_live')
    def test_render_live_stacked_layout(self, mock_draw_live):
        """Test live rendering with stacked layout."""
        from PIL import Image, ImageDraw
        from datetime import datetime

        buffer = Image.new('RGB', (64, 32))
        draw = ImageDraw.Draw(buffer)
        snapshot = Mock()
        context = {'current_time': datetime.now()}

        self.board._render_live(buffer, draw, snapshot, context)
        mock_draw_live.assert_called_once()

    @patch('src.render.scenes.live_big.draw_live_big')
    def test_render_live_big_logos_layout(self, mock_draw_big):
        """Test live rendering with big-logos layout."""
        from PIL import Image, ImageDraw
        from datetime import datetime

        # Change layout to big-logos
        self.board.config['live_layout'] = 'big-logos'

        buffer = Image.new('RGB', (64, 32))
        draw = ImageDraw.Draw(buffer)
        snapshot = Mock()
        context = {'current_time': datetime.now()}

        self.board._render_live(buffer, draw, snapshot, context)
        mock_draw_big.assert_called_once()

    @patch('src.render.scenes.final.draw_final')
    def test_render_final(self, mock_draw_final):
        """Test final rendering uses existing function."""
        from PIL import Image, ImageDraw
        from datetime import datetime

        buffer = Image.new('RGB', (64, 32))
        draw = ImageDraw.Draw(buffer)
        snapshot = Mock()
        context = {'current_time': datetime.now()}

        self.board._render_final(buffer, draw, snapshot, context)
        mock_draw_final.assert_called_once()


if __name__ == '__main__':
    unittest.main()