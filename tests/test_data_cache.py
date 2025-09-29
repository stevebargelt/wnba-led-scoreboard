"""Unit tests for cache management."""

import unittest
import tempfile
import time
from pathlib import Path
from unittest.mock import Mock, patch

from src.data.cache import (
    CacheManager,
    CacheStrategy,
    CacheEntry,
    MultiLevelCache
)


class TestCacheEntry(unittest.TestCase):
    """Test cache entry functionality."""

    def test_cache_entry_creation(self):
        """Test creating a cache entry."""
        entry = CacheEntry("key", "value", 60)

        self.assertEqual(entry.key, "key")
        self.assertEqual(entry.value, "value")
        self.assertEqual(entry.ttl, 60)
        self.assertIsNotNone(entry.timestamp)

    def test_expiration_check(self):
        """Test cache entry expiration."""
        # Non-expiring entry
        entry = CacheEntry("key", "value", -1)
        self.assertFalse(entry.is_expired())

        # Expired entry
        entry = CacheEntry("key", "value", 0.001, timestamp=time.time() - 1)
        self.assertTrue(entry.is_expired())

        # Valid entry
        entry = CacheEntry("key", "value", 60)
        self.assertFalse(entry.is_expired())

    def test_age_calculation(self):
        """Test age calculation."""
        past_time = time.time() - 10
        entry = CacheEntry("key", "value", 60, timestamp=past_time)

        age = entry.age_seconds()
        self.assertAlmostEqual(age, 10, delta=0.1)


class TestCacheManager(unittest.TestCase):
    """Test cache manager functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.cache = CacheManager(
            strategy=CacheStrategy.HYBRID,
            cache_dir=self.temp_dir,
            max_memory_items=3,
            default_ttl=60
        )

    def tearDown(self):
        """Clean up test fixtures."""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_memory_cache_operations(self):
        """Test basic memory cache operations."""
        cache = CacheManager(strategy=CacheStrategy.MEMORY)

        # Set and get
        self.assertTrue(cache.set("key1", "value1"))
        self.assertEqual(cache.get("key1"), "value1")

        # Miss
        self.assertIsNone(cache.get("nonexistent"))
        self.assertEqual(cache.get("nonexistent", "default"), "default")

        # Delete
        self.assertTrue(cache.delete("key1"))
        self.assertIsNone(cache.get("key1"))
        self.assertFalse(cache.delete("nonexistent"))

    def test_disk_cache_operations(self):
        """Test disk cache operations."""
        cache = CacheManager(
            strategy=CacheStrategy.DISK,
            cache_dir=self.temp_dir
        )

        # Set and get
        cache.set("disk_key", {"data": "value"})
        self.assertEqual(cache.get("disk_key"), {"data": "value"})

        # Verify file exists
        cache_files = list(Path(self.temp_dir).glob("*.cache"))
        self.assertEqual(len(cache_files), 1)

        # Delete
        cache.delete("disk_key")
        cache_files = list(Path(self.temp_dir).glob("*.cache"))
        self.assertEqual(len(cache_files), 0)

    def test_hybrid_cache_operations(self):
        """Test hybrid cache operations."""
        # Set in both memory and disk
        self.cache.set("hybrid_key", "hybrid_value")

        # Should be in memory
        self.assertIn("hybrid_key", self.cache._memory_cache)

        # Should also be on disk
        cache_files = list(Path(self.temp_dir).glob("*.cache"))
        self.assertGreater(len(cache_files), 0)

    def test_ttl_expiration(self):
        """Test TTL expiration."""
        # Set with very short TTL
        self.cache.set("expire_key", "expire_value", ttl=0.001)

        # Wait for expiration
        time.sleep(0.01)

        # Should return None (expired)
        self.assertIsNone(self.cache.get("expire_key"))

        # But allow_stale should still return it
        self.assertEqual(
            self.cache.get("expire_key", allow_stale=True),
            "expire_value"
        )

    def test_memory_eviction(self):
        """Test memory cache eviction when full."""
        cache = CacheManager(
            strategy=CacheStrategy.MEMORY,
            max_memory_items=2
        )

        # Fill cache
        cache.set("key1", "value1")
        time.sleep(0.01)
        cache.set("key2", "value2")
        time.sleep(0.01)
        cache.set("key3", "value3")  # Should evict key1

        # key1 should be evicted
        self.assertIsNone(cache.get("key1"))
        self.assertEqual(cache.get("key2"), "value2")
        self.assertEqual(cache.get("key3"), "value3")

        stats = cache.get_stats()
        self.assertEqual(stats["evictions"], 1)

    def test_get_or_set(self):
        """Test get_or_set functionality."""
        call_count = 0

        def factory():
            nonlocal call_count
            call_count += 1
            return f"generated_{call_count}"

        # First call should generate
        value = self.cache.get_or_set("factory_key", factory)
        self.assertEqual(value, "generated_1")
        self.assertEqual(call_count, 1)

        # Second call should use cache
        value = self.cache.get_or_set("factory_key", factory)
        self.assertEqual(value, "generated_1")
        self.assertEqual(call_count, 1)  # Not called again

    def test_get_or_set_with_error(self):
        """Test get_or_set with factory error."""
        # Set a value first
        self.cache.set("error_key", "cached_value", ttl=0.001)
        time.sleep(0.01)  # Let it expire

        def failing_factory():
            raise Exception("Factory failed")

        # Should return stale value when factory fails
        value = self.cache.get_or_set("error_key", failing_factory)
        self.assertEqual(value, "cached_value")

    def test_clear_cache(self):
        """Test clearing all cache."""
        # Add items to cache
        self.cache.set("key1", "value1")
        self.cache.set("key2", "value2")

        # Clear
        self.cache.clear()

        # Should be empty
        self.assertIsNone(self.cache.get("key1"))
        self.assertIsNone(self.cache.get("key2"))
        cache_files = list(Path(self.temp_dir).glob("*.cache"))
        self.assertEqual(len(cache_files), 0)

    def test_cache_statistics(self):
        """Test cache statistics tracking."""
        # Generate some activity
        self.cache.set("key1", "value1")
        self.cache.get("key1")  # Hit
        self.cache.get("key2")  # Miss
        self.cache.get("key1")  # Hit

        stats = self.cache.get_stats()

        self.assertEqual(stats["hits"], 2)
        self.assertEqual(stats["misses"], 1)
        self.assertAlmostEqual(stats["hit_rate"], 2/3)
        self.assertEqual(stats["memory_items"], 1)
        self.assertEqual(stats["strategy"], "hybrid")

    def test_cleanup_expired(self):
        """Test cleanup of expired entries."""
        # Add entries with different TTLs
        self.cache.set("keep", "value", ttl=60)
        self.cache.set("expire1", "value", ttl=0.001)
        self.cache.set("expire2", "value", ttl=0.001)

        time.sleep(0.01)

        # Cleanup
        self.cache.cleanup_expired()

        # Only non-expired should remain
        self.assertEqual(self.cache.get("keep"), "value")
        self.assertIsNone(self.cache.get("expire1"))
        self.assertIsNone(self.cache.get("expire2"))

    def test_disk_path_sanitization(self):
        """Test that cache keys are sanitized for filesystem."""
        cache = CacheManager(strategy=CacheStrategy.DISK, cache_dir=self.temp_dir)

        # Keys with path separators
        cache.set("path/to/key", "value1")
        cache.set("path\\to\\key", "value2")

        # Both should work
        self.assertEqual(cache.get("path/to/key"), "value1")
        self.assertEqual(cache.get("path\\to\\key"), "value2")


class TestMultiLevelCache(unittest.TestCase):
    """Test multi-level cache functionality."""

    def setUp(self):
        """Set up test fixtures."""
        self.l1_cache = CacheManager(strategy=CacheStrategy.MEMORY, max_memory_items=2)
        self.l2_cache = CacheManager(strategy=CacheStrategy.MEMORY, max_memory_items=5)

        self.multi_cache = MultiLevelCache([
            (self.l1_cache, 100),  # High priority
            (self.l2_cache, 50),   # Lower priority
        ])

    def test_multi_level_get(self):
        """Test getting from multi-level cache."""
        # Set only in L2
        self.l2_cache.set("key", "value")

        # Get should find it in L2 and promote to L1
        value = self.multi_cache.get("key")
        self.assertEqual(value, "value")

        # Now should be in L1 too
        self.assertEqual(self.l1_cache.get("key"), "value")

    def test_multi_level_set(self):
        """Test setting in all cache levels."""
        self.multi_cache.set("key", "value", ttl=60)

        # Should be in both levels
        self.assertEqual(self.l1_cache.get("key"), "value")
        self.assertEqual(self.l2_cache.get("key"), "value")

    def test_multi_level_miss(self):
        """Test miss in all levels."""
        value = self.multi_cache.get("nonexistent", "default")
        self.assertEqual(value, "default")


if __name__ == '__main__':
    unittest.main()