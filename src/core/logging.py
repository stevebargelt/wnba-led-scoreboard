"""
Centralized logging configuration for the LED Scoreboard application.
"""

import logging
import logging.handlers
import os
import sys
from pathlib import Path
from typing import Optional


class ScoreboardLogger:
    """Centralized logger configuration for the application."""

    _instance: Optional['ScoreboardLogger'] = None
    _initialized: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._initialized:
            self._setup_logging()
            self._initialized = True

    def _setup_logging(self):
        """Configure root logger with appropriate handlers and formatters."""
        log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
        log_file = os.getenv('LOG_FILE', 'logs/scoreboard.log')

        # Create logs directory if needed
        if log_file:
            log_dir = Path(log_file).parent
            log_dir.mkdir(parents=True, exist_ok=True)

        # Configure root logger
        root_logger = logging.getLogger()
        root_logger.setLevel(getattr(logging, log_level, logging.INFO))

        # Clear any existing handlers
        root_logger.handlers.clear()

        # Console handler with color support
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(getattr(logging, log_level, logging.INFO))

        # Add color support if terminal supports it
        if sys.stdout.isatty():
            console_format = '%(asctime)s - %(levelname)s - %(name)s - %(message)s'
            console_formatter = ColoredFormatter(console_format)
        else:
            console_format = '%(asctime)s - %(levelname)s - %(name)s - %(message)s'
            console_formatter = logging.Formatter(console_format, datefmt='%H:%M:%S')

        console_handler.setFormatter(console_formatter)
        root_logger.addHandler(console_handler)

        # File handler with rotation
        if log_file and log_file != 'none':
            file_handler = logging.handlers.RotatingFileHandler(
                log_file,
                maxBytes=10 * 1024 * 1024,  # 10MB
                backupCount=5
            )
            file_format = '%(asctime)s - %(levelname)s - %(name)s - %(funcName)s:%(lineno)d - %(message)s'
            file_formatter = logging.Formatter(file_format)
            file_handler.setFormatter(file_formatter)
            file_handler.setLevel(logging.DEBUG)  # Always log debug to file
            root_logger.addHandler(file_handler)

    @staticmethod
    def get_logger(name: str) -> logging.Logger:
        """
        Get a logger instance for the given module name.

        Args:
            name: Module name (usually __name__)

        Returns:
            Configured logger instance
        """
        # Ensure logging is configured
        ScoreboardLogger()
        return logging.getLogger(name)


class ColoredFormatter(logging.Formatter):
    """Custom formatter with color support for console output."""

    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',     # Cyan
        'INFO': '\033[32m',      # Green
        'WARNING': '\033[33m',   # Yellow
        'ERROR': '\033[31m',     # Red
        'CRITICAL': '\033[35m',  # Magenta
        'RESET': '\033[0m'       # Reset
    }

    def format(self, record):
        # Add color to level name
        levelname = record.levelname
        if levelname in self.COLORS:
            record.levelname = f"{self.COLORS[levelname]}{levelname}{self.COLORS['RESET']}"

        # Format the message
        result = super().format(record)

        # Reset levelname for other handlers
        record.levelname = levelname

        return result


# Convenience function for getting a logger
def get_logger(name: str) -> logging.Logger:
    """
    Convenience function to get a logger instance.

    Args:
        name: Module name (usually __name__)

    Returns:
        Configured logger instance
    """
    return ScoreboardLogger.get_logger(name)


# Initialize logging when module is imported
_logger_instance = ScoreboardLogger()