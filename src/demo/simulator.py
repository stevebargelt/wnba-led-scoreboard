"""Demo simulator temporarily disabled during migration to league-based system."""

from typing import Optional
from datetime import datetime
from src.model.game import GameSnapshot

class DemoSimulator:
    """Placeholder demo simulator during migration."""

    def __init__(self, *args, **kwargs):
        print("[warning] Demo mode is temporarily disabled during migration to league-based system")

    def get_snapshot(self, now_local: datetime) -> Optional[GameSnapshot]:
        """Return no games in demo mode."""
        return None

def parse_demo_options(*args, **kwargs):
    """Placeholder for demo options parsing."""
    return None