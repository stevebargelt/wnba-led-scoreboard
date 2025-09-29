"""
Hardware RGB LED matrix display implementation.
"""

from typing import Optional

from src.config.supabase_config_loader import DeviceConfiguration
from src.core.logging import get_logger
from .base import BaseDisplay

logger = get_logger(__name__)


class MatrixDisplay(BaseDisplay):
    """Display implementation for hardware RGB LED matrices."""

    def __init__(self, config: DeviceConfiguration):
        """
        Initialize matrix display.

        Args:
            config: Device configuration
        """
        self._matrix = None
        super().__init__(config)

    def _init_display(self) -> None:
        """Initialize the RGB matrix hardware."""
        self._matrix = self._try_init_matrix()
        if self._matrix is None:
            logger.warning("Failed to initialize RGB matrix hardware")

    def _try_init_matrix(self) -> Optional['RGBMatrix']:
        """Try to initialize the RGB matrix hardware."""
        try:
            from rgbmatrix import RGBMatrix, RGBMatrixOptions
        except ImportError as e:
            logger.warning(f"rgbmatrix library not available: {e}")
            return None

        opts = RGBMatrixOptions()
        opts.rows = self.display_config.height
        opts.cols = self.display_config.width
        opts.chain_length = self.display_config.chain_length
        opts.parallel = self.display_config.parallel
        opts.gpio_slowdown = self.display_config.gpio_slowdown
        opts.hardware_mapping = self.display_config.hardware_mapping
        opts.brightness = self.display_config.brightness
        opts.pwm_bits = self.display_config.pwm_bits

        try:
            matrix = RGBMatrix(options=opts)
            logger.info(f"RGB matrix initialized: {self.width}x{self.height}, "
                       f"brightness={self.display_config.brightness}%, "
                       f"pwm_bits={self.display_config.pwm_bits}")
            return matrix
        except Exception as e:
            logger.error(f"Failed to initialize RGBMatrix: {e}")
            return None

    def _flush_display(self) -> None:
        """Flush buffer to the RGB matrix hardware."""
        if self._matrix is not None:
            try:
                self._matrix.SetImage(self._buffer)
            except Exception as e:
                logger.error(f"Failed to set image on RGB matrix: {e}")
        else:
            logger.debug("No matrix hardware available for flush")

    def is_available(self) -> bool:
        """Check if hardware matrix is available."""
        return self._matrix is not None

    def close(self) -> None:
        """Clean up matrix resources."""
        if self._matrix is not None:
            try:
                self._matrix.Clear()
            except Exception as e:
                logger.error(f"Failed to clear matrix on close: {e}")
            self._matrix = None
        super().close()