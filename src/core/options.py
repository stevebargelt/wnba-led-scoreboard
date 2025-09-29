"""
Runtime options and configuration for the LED Scoreboard application.
"""

import argparse
import os
from dataclasses import dataclass, field
from typing import Optional, List
from src.demo.simulator import DEFAULT_ROTATION_SECONDS


@dataclass
class RuntimeOptions:
    """Runtime options for the application."""

    # Configuration
    config_path: str = "config/favorites.json"

    # Display options
    force_simulation: bool = False
    run_once: bool = False

    # Demo mode options
    demo_mode: bool = False
    demo_leagues: List[str] = field(default_factory=list)
    demo_rotation_seconds: int = DEFAULT_ROTATION_SECONDS

    # Derived properties
    @property
    def is_demo(self) -> bool:
        """Check if running in demo mode (from args or environment)."""
        return self.demo_mode or os.getenv("DEMO_MODE", "false").lower() == "true"

    @property
    def is_simulation(self) -> bool:
        """Check if running in simulation mode (from args or environment)."""
        return self.force_simulation or os.getenv("SIMULATION_MODE", "false").lower() == "true"

    @classmethod
    def from_args(cls, args: Optional[List[str]] = None) -> 'RuntimeOptions':
        """
        Create RuntimeOptions from command line arguments.

        Args:
            args: Command line arguments (None uses sys.argv)

        Returns:
            RuntimeOptions instance
        """
        parser = cls._create_parser()
        parsed = parser.parse_args(args)

        # Handle demo leagues from both args and environment
        demo_leagues = parsed.demo_league or []
        env_demo_leagues = os.getenv("DEMO_LEAGUES")
        if env_demo_leagues and not demo_leagues:
            demo_leagues = env_demo_leagues.split(",")

        # Handle demo rotation from both args and environment
        rotation_seconds = parsed.demo_rotation
        if rotation_seconds is None:
            env_rotation = os.getenv("DEMO_ROTATION_SECONDS")
            if env_rotation:
                try:
                    rotation_seconds = int(env_rotation)
                except ValueError:
                    rotation_seconds = DEFAULT_ROTATION_SECONDS
        if rotation_seconds is None:
            rotation_seconds = DEFAULT_ROTATION_SECONDS

        return cls(
            config_path=parsed.config,
            force_simulation=parsed.sim,
            run_once=parsed.once,
            demo_mode=parsed.demo,
            demo_leagues=demo_leagues,
            demo_rotation_seconds=rotation_seconds
        )

    @staticmethod
    def _create_parser() -> argparse.ArgumentParser:
        """Create the argument parser."""
        parser = argparse.ArgumentParser(
            description="Multi-League LED Scoreboard",
            formatter_class=argparse.RawDescriptionHelpFormatter
        )

        # Configuration
        parser.add_argument(
            "--config",
            default="config/favorites.json",
            help="Path to favorites/config JSON (default: config/favorites.json)"
        )

        # Display options
        parser.add_argument(
            "--sim",
            action="store_true",
            help="Force simulate display (no matrix hardware required)"
        )

        parser.add_argument(
            "--once",
            action="store_true",
            help="Run one update cycle and exit"
        )

        # Demo mode options
        parser.add_argument(
            "--demo",
            action="store_true",
            help="Run in demo mode with simulated games"
        )

        parser.add_argument(
            "--demo-league",
            action="append",
            help="Limit demo mode to specific leagues (can be provided multiple times)"
        )

        parser.add_argument(
            "--demo-rotation",
            type=int,
            default=None,
            help=f"Number of seconds to show each league before rotating in demo mode (default: {DEFAULT_ROTATION_SECONDS})"
        )

        return parser

    def validate(self) -> None:
        """
        Validate runtime options.

        Raises:
            ValueError: If options are invalid
        """
        # Check for required environment variables when not in demo mode
        if not self.is_demo:
            required_env = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DEVICE_ID"]
            missing = [var for var in required_env if not os.getenv(var)]
            if missing:
                raise ValueError(
                    f"Missing required environment variables: {', '.join(missing)}. "
                    f"Please set these in your .env file or environment."
                )

        # Validate demo rotation seconds
        if self.demo_rotation_seconds < 1:
            raise ValueError(f"Demo rotation seconds must be at least 1, got {self.demo_rotation_seconds}")

        # Validate demo leagues if specified
        if self.demo_leagues:
            valid_leagues = ["nhl", "nba", "wnba", "mlb", "nfl", "mls"]
            invalid = [league for league in self.demo_leagues if league.lower() not in valid_leagues]
            if invalid:
                raise ValueError(
                    f"Invalid demo leagues: {', '.join(invalid)}. "
                    f"Valid options are: {', '.join(valid_leagues)}"
                )

    def __str__(self) -> str:
        """String representation of options."""
        lines = [
            "Runtime Options:",
            f"  Config Path: {self.config_path}",
            f"  Simulation Mode: {self.is_simulation}",
            f"  Run Once: {self.run_once}",
            f"  Demo Mode: {self.is_demo}",
        ]
        if self.is_demo:
            lines.append(f"  Demo Leagues: {', '.join(self.demo_leagues) if self.demo_leagues else 'All'}")
            lines.append(f"  Demo Rotation: {self.demo_rotation_seconds}s")
        return "\n".join(lines)