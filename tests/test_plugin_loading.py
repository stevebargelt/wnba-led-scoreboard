"""Tests for plugin board loading functionality."""

import unittest
import tempfile
import shutil
import json
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

from src.boards.manager import BoardManager
from src.boards.base import BoardBase


class TestPluginLoading(unittest.TestCase):
    """Test plugin loading with various edge cases."""

    def setUp(self):
        """Set up test fixtures."""
        # Create temporary plugin directory
        self.temp_dir = tempfile.mkdtemp()
        self.plugins_dir = Path(self.temp_dir) / "src" / "boards" / "plugins"
        self.plugins_dir.mkdir(parents=True)

        # Mock device configuration
        self.mock_config = Mock()
        self.mock_config.board_configs = {}
        self.mock_config.render_config = Mock()
        self.mock_config.render_config.logo_variant = 'mini'
        self.mock_config.render_config.live_layout = 'stacked'

    def tearDown(self):
        """Clean up temporary directory."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_load_valid_plugin(self):
        """Test loading a valid plugin board."""
        # Create valid plugin
        plugin_dir = self.plugins_dir / "test_plugin"
        plugin_dir.mkdir()

        # Create board.py with valid board class
        board_content = '''
from src.boards.base import BoardBase

class TestPluginBoard(BoardBase):
    def render(self, buffer, draw, context):
        pass

    def should_display(self, context):
        return True
'''
        (plugin_dir / "board.py").write_text(board_content)

        # Create config.json
        config = {"enabled": True, "priority": 50}
        (plugin_dir / "config.json").write_text(json.dumps(config))

        # Patch the plugins directory path
        with patch('src.boards.manager.Path') as mock_path:
            mock_path.return_value = self.plugins_dir

            # Load plugins
            with patch.object(BoardManager, '_load_builtin_boards'):
                manager = BoardManager(self.mock_config)

            # Check plugin was loaded
            self.assertIn('plugin_test_plugin', manager.boards)
            board = manager.boards['plugin_test_plugin']
            self.assertTrue(board.enabled)
            self.assertEqual(board.priority, 50)

    def test_skip_plugin_without_board_py(self):
        """Test that plugins without board.py are skipped."""
        # Create plugin directory without board.py
        plugin_dir = self.plugins_dir / "incomplete_plugin"
        plugin_dir.mkdir()
        (plugin_dir / "something.py").write_text("# Not a board file")

        with patch('src.boards.manager.Path') as mock_path:
            mock_path.return_value = self.plugins_dir

            with patch.object(BoardManager, '_load_builtin_boards'):
                manager = BoardManager(self.mock_config)

            # Plugin should not be loaded
            self.assertNotIn('plugin_incomplete_plugin', manager.boards)

    def test_handle_malformed_plugin_syntax_error(self):
        """Test handling plugin with syntax errors."""
        plugin_dir = self.plugins_dir / "broken_plugin"
        plugin_dir.mkdir()

        # Create board.py with syntax error
        board_content = '''
from src.boards.base import BoardBase

class BrokenBoard(BoardBase):
    def render(self, buffer, draw, context)  # Missing colon
        pass
'''
        (plugin_dir / "board.py").write_text(board_content)

        with patch('src.boards.manager.Path') as mock_path:
            mock_path.return_value = self.plugins_dir

            with patch.object(BoardManager, '_load_builtin_boards'):
                # Should not raise exception, just skip the plugin
                manager = BoardManager(self.mock_config)

            # Plugin should not be loaded
            self.assertNotIn('plugin_broken_plugin', manager.boards)

    def test_handle_plugin_import_error(self):
        """Test handling plugin with import errors."""
        plugin_dir = self.plugins_dir / "import_error_plugin"
        plugin_dir.mkdir()

        # Create board.py with import error
        board_content = '''
from nonexistent.module import Something
from src.boards.base import BoardBase

class ImportErrorBoard(BoardBase):
    def render(self, buffer, draw, context):
        pass

    def should_display(self, context):
        return True
'''
        (plugin_dir / "board.py").write_text(board_content)

        with patch('src.boards.manager.Path') as mock_path:
            mock_path.return_value = self.plugins_dir

            with patch.object(BoardManager, '_load_builtin_boards'):
                # Should not raise exception, just skip the plugin
                manager = BoardManager(self.mock_config)

            # Plugin should not be loaded
            self.assertNotIn('plugin_import_error_plugin', manager.boards)

    def test_plugin_without_boardbase_inheritance(self):
        """Test that plugins not inheriting from BoardBase are skipped."""
        plugin_dir = self.plugins_dir / "no_inheritance_plugin"
        plugin_dir.mkdir()

        # Create board.py without BoardBase inheritance
        board_content = '''
class NotABoard:
    def render(self, buffer, draw, context):
        pass

    def should_display(self, context):
        return True
'''
        (plugin_dir / "board.py").write_text(board_content)

        with patch('src.boards.manager.Path') as mock_path:
            mock_path.return_value = self.plugins_dir

            with patch.object(BoardManager, '_load_builtin_boards'):
                manager = BoardManager(self.mock_config)

            # Plugin should not be loaded
            self.assertNotIn('plugin_no_inheritance_plugin', manager.boards)

    def test_plugin_with_multiple_board_classes(self):
        """Test plugin with multiple board classes (should load first valid one)."""
        plugin_dir = self.plugins_dir / "multi_board_plugin"
        plugin_dir.mkdir()

        board_content = '''
from src.boards.base import BoardBase

class FirstBoard(BoardBase):
    def render(self, buffer, draw, context):
        pass

    def should_display(self, context):
        return True

class SecondBoard(BoardBase):
    def render(self, buffer, draw, context):
        pass

    def should_display(self, context):
        return False
'''
        (plugin_dir / "board.py").write_text(board_content)

        with patch('src.boards.manager.Path') as mock_path:
            mock_path.return_value = self.plugins_dir

            with patch.object(BoardManager, '_load_builtin_boards'):
                manager = BoardManager(self.mock_config)

            # Should load first board
            self.assertIn('plugin_multi_board_plugin', manager.boards)
            board = manager.boards['plugin_multi_board_plugin']
            # Test that it's the first board by checking should_display
            self.assertTrue(board.should_display({}))

    def test_plugin_with_invalid_config_json(self):
        """Test plugin with malformed config.json."""
        plugin_dir = self.plugins_dir / "bad_config_plugin"
        plugin_dir.mkdir()

        # Create valid board.py
        board_content = '''
from src.boards.base import BoardBase

class BadConfigBoard(BoardBase):
    def render(self, buffer, draw, context):
        pass

    def should_display(self, context):
        return True
'''
        (plugin_dir / "board.py").write_text(board_content)

        # Create invalid config.json
        (plugin_dir / "config.json").write_text("{ invalid json }")

        with patch('src.boards.manager.Path') as mock_path:
            mock_path.return_value = self.plugins_dir

            with patch.object(BoardManager, '_load_builtin_boards'):
                # Should fail to load due to JSON error
                manager = BoardManager(self.mock_config)

            # Plugin should NOT be loaded due to config error
            self.assertNotIn('plugin_bad_config_plugin', manager.boards)

    def test_plugin_instantiation_error(self):
        """Test handling plugin that raises exception during instantiation."""
        plugin_dir = self.plugins_dir / "instantiation_error_plugin"
        plugin_dir.mkdir()

        board_content = '''
from src.boards.base import BoardBase

class ErrorBoard(BoardBase):
    def __init__(self, config):
        super().__init__(config)
        raise ValueError("Instantiation failed!")

    def render(self, buffer, draw, context):
        pass

    def should_display(self, context):
        return True
'''
        (plugin_dir / "board.py").write_text(board_content)

        with patch('src.boards.manager.Path') as mock_path:
            mock_path.return_value = self.plugins_dir

            with patch.object(BoardManager, '_load_builtin_boards'):
                # Should not raise exception, just skip the plugin
                manager = BoardManager(self.mock_config)

            # Plugin should not be loaded
            self.assertNotIn('plugin_instantiation_error_plugin', manager.boards)

    def test_skip_non_directory_files(self):
        """Test that non-directory files in plugins folder are skipped."""
        # Create a file (not directory) in plugins folder
        (self.plugins_dir / "README.md").write_text("# Plugin Documentation")

        with patch('src.boards.manager.Path') as mock_path:
            mock_path.return_value = self.plugins_dir

            with patch.object(BoardManager, '_load_builtin_boards'):
                # Should not raise exception
                manager = BoardManager(self.mock_config)

            # No plugins should be loaded
            plugin_boards = [k for k in manager.boards.keys() if k.startswith('plugin_')]
            self.assertEqual(len(plugin_boards), 0)

    def test_plugin_with_init_file(self):
        """Test plugin with __init__.py file."""
        plugin_dir = self.plugins_dir / "init_plugin"
        plugin_dir.mkdir()

        # Create __init__.py
        (plugin_dir / "__init__.py").write_text("# Plugin init")

        # Create board.py
        board_content = '''
from src.boards.base import BoardBase

class InitPluginBoard(BoardBase):
    def render(self, buffer, draw, context):
        pass

    def should_display(self, context):
        return True
'''
        (plugin_dir / "board.py").write_text(board_content)

        with patch('src.boards.manager.Path') as mock_path:
            mock_path.return_value = self.plugins_dir

            with patch.object(BoardManager, '_load_builtin_boards'):
                manager = BoardManager(self.mock_config)

            # Plugin should still load successfully
            self.assertIn('plugin_init_plugin', manager.boards)

    def test_no_plugins_directory(self):
        """Test handling when plugins directory doesn't exist."""
        with patch('src.boards.manager.Path') as mock_path:
            # Return non-existent path
            mock_path.return_value = Path("/nonexistent/path")

            with patch.object(BoardManager, '_load_builtin_boards'):
                # Should not raise exception
                manager = BoardManager(self.mock_config)

            # No plugins loaded
            plugin_boards = [k for k in manager.boards.keys() if k.startswith('plugin_')]
            self.assertEqual(len(plugin_boards), 0)


if __name__ == '__main__':
    unittest.main()