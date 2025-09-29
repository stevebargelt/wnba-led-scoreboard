"""
Simulator display implementation that outputs to PNG files.
"""

from pathlib import Path

from src.config.supabase_config_loader import DeviceConfiguration
from src.core.logging import get_logger
from .base import BaseDisplay

logger = get_logger(__name__)


class SimulatorDisplay(BaseDisplay):
    """Display implementation that outputs to PNG files for development."""

    def __init__(self, config: DeviceConfiguration, output_dir: str = "out"):
        """
        Initialize simulator display.

        Args:
            config: Device configuration
            output_dir: Directory to save PNG frames
        """
        self.output_dir = Path(output_dir)
        self.frame_count = 0
        super().__init__(config)

    def _init_display(self) -> None:
        """Initialize the simulator display."""
        self.output_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"Simulator display initialized: {self.width}x{self.height}, "
                   f"output_dir={self.output_dir}")

    def _flush_display(self) -> None:
        """Save the current buffer to a PNG file."""
        try:
            frame_path = self.output_dir / "frame.png"
            self._buffer.save(frame_path)

            if self.frame_count % 100 == 0:
                timestamped_path = self.output_dir / f"frame_{self.frame_count:06d}.png"
                self._buffer.save(timestamped_path)
                logger.debug(f"Saved frame {self.frame_count} to {timestamped_path}")

            self.frame_count += 1
        except Exception as e:
            logger.error(f"Failed to save frame to PNG: {e}")

    def get_last_frame_path(self) -> Path:
        """Get the path to the last saved frame."""
        return self.output_dir / "frame.png"

    def get_frame_count(self) -> int:
        """Get the number of frames rendered."""
        return self.frame_count

    def reset_frame_count(self) -> None:
        """Reset the frame counter."""
        self.frame_count = 0
        logger.debug("Frame count reset to 0")

    def close(self) -> None:
        """Clean up simulator resources."""
        logger.info(f"Simulator display closed after {self.frame_count} frames")
        super().close()