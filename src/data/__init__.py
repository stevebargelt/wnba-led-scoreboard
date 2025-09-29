"""
Data layer components for game data management.
"""

from .cache import CacheManager, CacheStrategy, MultiLevelCache
from .providers import (
    LeagueAggregatorProvider,
    DemoProvider,
    SingleLeagueProvider,
    MockProvider
)

__all__ = [
    # Cache
    "CacheManager",
    "CacheStrategy",
    "MultiLevelCache",

    # Provider Implementations (GameProvider interface is in src.core.interfaces)
    "LeagueAggregatorProvider",
    "DemoProvider",
    "SingleLeagueProvider",
    "MockProvider",
]