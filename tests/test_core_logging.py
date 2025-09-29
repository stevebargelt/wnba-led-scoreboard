"""Unit tests for the ScoreboardLogger."""

import unittest
import logging
import os
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock
from src.core.logging import ScoreboardLogger, ColoredFormatter, get_logger


class TestScoreboardLogger(unittest.TestCase):
    """Test cases for ScoreboardLogger."""

    def setUp(self):
        """Set up test fixtures."""
        # Reset the singleton state
        ScoreboardLogger._instance = None
        ScoreboardLogger._initialized = False
        # Clear root logger handlers
        logging.getLogger().handlers.clear()

    def tearDown(self):
        """Clean up after tests."""
        # Reset singleton
        ScoreboardLogger._instance = None
        ScoreboardLogger._initialized = False
        # Clear handlers
        logging.getLogger().handlers.clear()

    def test_singleton_pattern(self):
        """Test that ScoreboardLogger follows singleton pattern."""
        logger1 = ScoreboardLogger()
        logger2 = ScoreboardLogger()

        self.assertIs(logger1, logger2)

    @patch.dict(os.environ, {"LOG_LEVEL": "DEBUG", "LOG_FILE": "none"})
    def test_log_level_from_environment(self):
        """Test setting log level from environment."""
        logger = ScoreboardLogger()
        root_logger = logging.getLogger()

        self.assertEqual(root_logger.level, logging.DEBUG)

    @patch.dict(os.environ, {"LOG_LEVEL": "WARNING", "LOG_FILE": "none"})
    def test_warning_log_level(self):
        """Test warning log level configuration."""
        logger = ScoreboardLogger()
        root_logger = logging.getLogger()

        self.assertEqual(root_logger.level, logging.WARNING)

    @patch.dict(os.environ, {"LOG_LEVEL": "INVALID", "LOG_FILE": "none"})
    def test_invalid_log_level_defaults_to_info(self):
        """Test that invalid log level defaults to INFO."""
        logger = ScoreboardLogger()
        root_logger = logging.getLogger()

        self.assertEqual(root_logger.level, logging.INFO)

    def test_console_handler_added(self):
        """Test that console handler is added to root logger."""
        with patch.dict(os.environ, {"LOG_FILE": "none"}):
            logger = ScoreboardLogger()
            root_logger = logging.getLogger()

            # Should have at least one StreamHandler
            stream_handlers = [h for h in root_logger.handlers if isinstance(h, logging.StreamHandler)]
            self.assertGreaterEqual(len(stream_handlers), 1)

    def test_file_handler_with_rotation(self):
        """Test file handler creation with rotation."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = os.path.join(temp_dir, "test.log")

            with patch.dict(os.environ, {"LOG_FILE": log_file}):
                logger = ScoreboardLogger()
                root_logger = logging.getLogger()

                # Should have a RotatingFileHandler
                file_handlers = [h for h in root_logger.handlers
                               if isinstance(h, logging.handlers.RotatingFileHandler)]
                self.assertEqual(len(file_handlers), 1)

                # Check file handler properties
                handler = file_handlers[0]
                self.assertEqual(handler.maxBytes, 10 * 1024 * 1024)  # 10MB
                self.assertEqual(handler.backupCount, 5)

    def test_log_directory_creation(self):
        """Test that log directory is created if it doesn't exist."""
        with tempfile.TemporaryDirectory() as temp_dir:
            log_file = os.path.join(temp_dir, "subdir", "test.log")

            with patch.dict(os.environ, {"LOG_FILE": log_file}):
                logger = ScoreboardLogger()

                # Directory should be created
                self.assertTrue(Path(temp_dir, "subdir").exists())

    def test_get_logger_returns_configured_logger(self):
        """Test that get_logger returns a properly configured logger."""
        with patch.dict(os.environ, {"LOG_FILE": "none"}):
            logger_instance = ScoreboardLogger()
            test_logger = logger_instance.get_logger("test.module")

            self.assertIsInstance(test_logger, logging.Logger)
            self.assertEqual(test_logger.name, "test.module")

    def test_multiple_init_doesnt_duplicate_handlers(self):
        """Test that multiple initializations don't duplicate handlers."""
        with patch.dict(os.environ, {"LOG_FILE": "none"}):
            logger1 = ScoreboardLogger()
            initial_handler_count = len(logging.getLogger().handlers)

            # Create another instance (should be same due to singleton)
            logger2 = ScoreboardLogger()
            final_handler_count = len(logging.getLogger().handlers)

            self.assertEqual(initial_handler_count, final_handler_count)

    def test_get_logger_function(self):
        """Test the module-level get_logger function."""
        with patch.dict(os.environ, {"LOG_FILE": "none"}):
            logger = get_logger("test.module")

            self.assertIsInstance(logger, logging.Logger)
            self.assertEqual(logger.name, "test.module")


class TestColoredFormatter(unittest.TestCase):
    """Test cases for ColoredFormatter."""

    def test_format_adds_color_codes(self):
        """Test that formatter adds color codes to level names."""
        formatter = ColoredFormatter('%(levelname)s - %(message)s')

        # Create a log record
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="Test message",
            args=(),
            exc_info=None
        )

        formatted = formatter.format(record)

        # Should contain green color code for INFO
        self.assertIn('\033[32m', formatted)  # Green
        self.assertIn('\033[0m', formatted)   # Reset
        self.assertIn('INFO', formatted)

    def test_format_different_levels(self):
        """Test color formatting for different log levels."""
        formatter = ColoredFormatter('%(levelname)s')

        test_cases = [
            (logging.DEBUG, '\033[36m'),    # Cyan
            (logging.INFO, '\033[32m'),     # Green
            (logging.WARNING, '\033[33m'),  # Yellow
            (logging.ERROR, '\033[31m'),    # Red
            (logging.CRITICAL, '\033[35m'), # Magenta
        ]

        for level, expected_color in test_cases:
            record = logging.LogRecord(
                name="test",
                level=level,
                pathname="",
                lineno=0,
                msg="Test",
                args=(),
                exc_info=None
            )

            formatted = formatter.format(record)
            self.assertIn(expected_color, formatted)

    def test_levelname_reset_after_format(self):
        """Test that levelname is reset after formatting."""
        formatter = ColoredFormatter('%(levelname)s')

        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="Test",
            args=(),
            exc_info=None
        )

        original_levelname = record.levelname
        formatter.format(record)

        # Levelname should be reset to original
        self.assertEqual(record.levelname, original_levelname)
        self.assertEqual(record.levelname, "INFO")


if __name__ == '__main__':
    unittest.main()