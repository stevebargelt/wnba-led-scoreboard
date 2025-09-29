"""
Custom exceptions for the scoreboard application.
"""


class ScoreboardException(Exception):
    """Base exception for all scoreboard-related errors."""
    pass


class ConfigurationError(ScoreboardException):
    """Raised when configuration is invalid or cannot be loaded."""
    pass


class ServiceError(ScoreboardException):
    """Base exception for service-related errors."""
    pass


class ServiceInitializationError(ServiceError):
    """Raised when a service fails to initialize."""
    pass


class ServiceResolutionError(ServiceError):
    """Raised when a service cannot be resolved from the container."""
    pass


class ProviderError(ScoreboardException):
    """Base exception for provider-related errors."""
    pass


class GameProviderError(ProviderError):
    """Raised when game provider encounters an error."""
    pass


class APIError(ProviderError):
    """Raised when external API calls fail."""
    pass


class CriticalError(ScoreboardException):
    """Raised for critical errors that should halt execution."""
    pass


class TransientError(ScoreboardException):
    """Raised for temporary errors that can be retried."""
    pass


class ConfigurationReloadError(ConfigurationError):
    """Raised when configuration reload fails."""

    def __init__(self, message: str, partial_config=None):
        super().__init__(message)
        self.partial_config = partial_config