"""
Centralized cache management for data layer.
"""

import json
import pickle
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional, Union, Dict, Callable
from enum import Enum

from src.core.logging import get_logger

logger = get_logger(__name__)


class CacheStrategy(Enum):
    """Cache storage strategies."""
    MEMORY = "memory"
    DISK = "disk"
    HYBRID = "hybrid"  # Memory with disk backup


class CacheEntry:
    """Represents a cached item with metadata."""

    def __init__(self, key: str, value: Any, ttl: int, timestamp: float = None):
        """
        Initialize cache entry.

        Args:
            key: Cache key
            value: Cached value
            ttl: Time to live in seconds
            timestamp: Creation timestamp (defaults to now)
        """
        self.key = key
        self.value = value
        self.ttl = ttl
        self.timestamp = timestamp or time.time()

    def is_expired(self) -> bool:
        """Check if cache entry has expired."""
        if self.ttl <= 0:  # Negative TTL means never expire
            return False
        return time.time() - self.timestamp > self.ttl

    def age_seconds(self) -> float:
        """Get age of cache entry in seconds."""
        return time.time() - self.timestamp


class CacheManager:
    """
    Centralized cache management with multiple storage strategies.
    """

    def __init__(
        self,
        strategy: CacheStrategy = CacheStrategy.HYBRID,
        cache_dir: str = "cache",
        max_memory_items: int = 1000,
        default_ttl: int = 300
    ):
        """
        Initialize cache manager.

        Args:
            strategy: Cache storage strategy
            cache_dir: Directory for disk cache
            max_memory_items: Maximum items in memory cache
            default_ttl: Default time to live in seconds
        """
        self.strategy = strategy
        self.cache_dir = Path(cache_dir)
        self.max_memory_items = max_memory_items
        self.default_ttl = default_ttl

        # Memory cache
        self._memory_cache: Dict[str, CacheEntry] = {}

        # Statistics
        self._stats = {
            "hits": 0,
            "misses": 0,
            "evictions": 0,
            "errors": 0
        }

        # Setup disk cache if needed
        if strategy in [CacheStrategy.DISK, CacheStrategy.HYBRID]:
            self._setup_disk_cache()

    def _setup_disk_cache(self):
        """Create disk cache directory structure."""
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Disk cache initialized at {self.cache_dir}")

    def get(
        self,
        key: str,
        default: Any = None,
        allow_stale: bool = False
    ) -> Optional[Any]:
        """
        Get item from cache.

        Args:
            key: Cache key
            default: Default value if not found
            allow_stale: Return stale data if available

        Returns:
            Cached value or default
        """
        # Try memory cache first
        if self.strategy in [CacheStrategy.MEMORY, CacheStrategy.HYBRID]:
            entry = self._memory_cache.get(key)
            if entry:
                if not entry.is_expired():
                    self._stats["hits"] += 1
                    logger.debug(f"Cache hit (memory): {key}")
                    return entry.value
                elif allow_stale:
                    self._stats["hits"] += 1
                    logger.debug(f"Cache hit (memory, stale): {key}")
                    return entry.value
                else:
                    # Remove expired entry only if not allowing stale
                    del self._memory_cache[key]

        # Try disk cache
        if self.strategy in [CacheStrategy.DISK, CacheStrategy.HYBRID]:
            value = self._load_from_disk(key, allow_stale)
            if value is not None:
                self._stats["hits"] += 1
                logger.debug(f"Cache hit (disk): {key}")

                # Promote to memory if using hybrid
                if self.strategy == CacheStrategy.HYBRID:
                    self._memory_cache[key] = CacheEntry(key, value, self.default_ttl)
                    self._evict_if_needed()

                return value

        self._stats["misses"] += 1
        logger.debug(f"Cache miss: {key}")
        return default

    def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """
        Set item in cache.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds (defaults to default_ttl)

        Returns:
            True if successful, False otherwise
        """
        ttl = ttl or self.default_ttl
        entry = CacheEntry(key, value, ttl)

        try:
            # Store in memory
            if self.strategy in [CacheStrategy.MEMORY, CacheStrategy.HYBRID]:
                self._memory_cache[key] = entry
                self._evict_if_needed()

            # Store on disk
            if self.strategy in [CacheStrategy.DISK, CacheStrategy.HYBRID]:
                self._save_to_disk(key, entry)

            logger.debug(f"Cache set: {key} (TTL: {ttl}s)")
            return True

        except Exception as e:
            self._stats["errors"] += 1
            logger.error(f"Failed to cache {key}: {e}")
            return False

    def delete(self, key: str) -> bool:
        """
        Delete item from cache.

        Args:
            key: Cache key

        Returns:
            True if item was deleted, False if not found
        """
        deleted = False

        # Remove from memory
        if key in self._memory_cache:
            del self._memory_cache[key]
            deleted = True

        # Remove from disk
        disk_path = self._get_disk_path(key)
        if disk_path.exists():
            disk_path.unlink()
            deleted = True

        if deleted:
            logger.debug(f"Cache deleted: {key}")

        return deleted

    def clear(self):
        """Clear all cached items."""
        # Clear memory
        self._memory_cache.clear()

        # Clear disk
        if self.strategy in [CacheStrategy.DISK, CacheStrategy.HYBRID]:
            for cache_file in self.cache_dir.glob("*.cache"):
                cache_file.unlink()

        logger.info("Cache cleared")

    def get_or_set(
        self,
        key: str,
        factory: Callable[[], Any],
        ttl: Optional[int] = None,
        allow_stale: bool = False
    ) -> Any:
        """
        Get from cache or generate and cache if missing.

        Args:
            key: Cache key
            factory: Function to generate value if not cached
            ttl: Time to live in seconds
            allow_stale: Return stale data if available

        Returns:
            Cached or generated value
        """
        # First try to get from cache (respecting allow_stale)
        value = self.get(key, allow_stale=allow_stale)

        if value is None:
            try:
                value = factory()
                if value is not None:
                    self.set(key, value, ttl)
            except Exception as e:
                logger.error(f"Factory function failed for {key}: {e}")
                # Try stale as fallback when factory fails
                value = self.get(key, allow_stale=True)

        return value

    def _evict_if_needed(self):
        """Evict oldest items if memory cache is full."""
        if len(self._memory_cache) <= self.max_memory_items:
            return

        # Sort by timestamp and remove oldest
        sorted_items = sorted(
            self._memory_cache.items(),
            key=lambda x: x[1].timestamp
        )

        # Only evict if we're over the limit
        num_to_evict = len(self._memory_cache) - self.max_memory_items
        if num_to_evict > 0:
            for key, _ in sorted_items[:num_to_evict]:
                del self._memory_cache[key]
                self._stats["evictions"] += 1

            logger.debug(f"Evicted {num_to_evict} items from memory cache")

    def _get_disk_path(self, key: str) -> Path:
        """Get disk path for cache key."""
        # Sanitize key for filesystem - use different replacements for different separators
        safe_key = key.replace("/", "_fwd_").replace("\\", "_bck_")
        # Also handle other problematic characters
        safe_key = safe_key.replace(":", "_col_").replace("*", "_ast_")
        return self.cache_dir / f"{safe_key}.cache"

    def _save_to_disk(self, key: str, entry: CacheEntry):
        """Save cache entry to disk."""
        try:
            path = self._get_disk_path(key)
            with open(path, "wb") as f:
                pickle.dump(entry, f)
        except Exception as e:
            logger.error(f"Failed to save {key} to disk: {e}")
            self._stats["errors"] += 1

    def _load_from_disk(self, key: str, allow_stale: bool = False) -> Optional[Any]:
        """Load cache entry from disk."""
        try:
            path = self._get_disk_path(key)
            if not path.exists():
                return None

            with open(path, "rb") as f:
                entry = pickle.load(f)

            if not entry.is_expired():
                return entry.value
            elif allow_stale:
                # Return stale value but don't delete file
                return entry.value
            else:
                # Don't delete expired files immediately - they may be needed for stale access
                # Files will be cleaned up by cleanup_expired() method instead
                return None

        except Exception as e:
            logger.error(f"Failed to load {key} from disk: {e}")
            self._stats["errors"] += 1
            return None

    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.

        Returns:
            Dictionary of cache statistics
        """
        total = self._stats["hits"] + self._stats["misses"]
        hit_rate = self._stats["hits"] / total if total > 0 else 0

        return {
            **self._stats,
            "memory_items": len(self._memory_cache),
            "hit_rate": hit_rate,
            "strategy": self.strategy.value
        }

    def cleanup_expired(self):
        """Remove all expired entries."""
        # Clean memory cache
        expired_keys = [
            key for key, entry in self._memory_cache.items()
            if entry.is_expired()
        ]
        for key in expired_keys:
            del self._memory_cache[key]

        # Clean disk cache
        if self.strategy in [CacheStrategy.DISK, CacheStrategy.HYBRID]:
            for cache_file in self.cache_dir.glob("*.cache"):
                try:
                    with open(cache_file, "rb") as f:
                        entry = pickle.load(f)
                    if entry.is_expired():
                        cache_file.unlink()
                except Exception as e:
                    logger.error(f"Error cleaning up {cache_file}: {e}")

        logger.info(f"Cleaned up {len(expired_keys)} expired entries")


class MultiLevelCache:
    """
    Multi-level cache with fallback support.
    """

    def __init__(self, levels: list[tuple[CacheManager, int]]):
        """
        Initialize multi-level cache.

        Args:
            levels: List of (CacheManager, priority) tuples
        """
        self.levels = sorted(levels, key=lambda x: x[1], reverse=True)

    def get(self, key: str, default: Any = None) -> Optional[Any]:
        """Get from first available cache level."""
        for cache, _ in self.levels:
            value = cache.get(key, default=None)
            if value is not None:
                # Promote to higher levels
                for higher_cache, _ in self.levels:
                    if higher_cache is cache:
                        break
                    higher_cache.set(key, value)
                return value
        return default

    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Set in all cache levels."""
        for cache, _ in self.levels:
            cache.set(key, value, ttl)