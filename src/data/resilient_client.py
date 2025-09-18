"""
Resilient HTTP client with exponential backoff, circuit breaker, and caching.
"""

import json
import os
import time
from datetime import date, datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, TypedDict
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


class CircuitState(Enum):
    CLOSED = "closed"    # Normal operation
    OPEN = "open"        # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered


class CacheEntry(TypedDict):
    data: Any
    timestamp: float
    expires_at: float


class ResilientHTTPClient:
    """HTTP client with exponential backoff, circuit breaker, and caching."""
    
    def __init__(
        self,
        base_url: str,
        cache_dir: Optional[str] = None,
        circuit_failure_threshold: int = 5,
        circuit_recovery_timeout: int = 60,
        cache_ttl: int = 300,  # 5 minutes default
        max_retries: int = 3,
        backoff_factor: float = 1.0,
        timeout: float = 10.0,
    ):
        self.base_url = base_url
        self.cache_dir = Path(cache_dir or "cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Circuit breaker state
        self.circuit_state = CircuitState.CLOSED
        self.failure_count = 0
        self.circuit_failure_threshold = circuit_failure_threshold
        self.circuit_recovery_timeout = circuit_recovery_timeout
        self.last_failure_time = 0
        
        # Cache settings
        self.cache_ttl = cache_ttl
        
        # Setup requests session with retry strategy
        self.session = requests.Session()
        retry_strategy = Retry(
            total=max_retries,
            status_forcelist=[429, 500, 502, 503, 504],
            backoff_factor=backoff_factor,
            respect_retry_after_header=True,
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        self.timeout = timeout
        
    def _get_cache_key(self, url: str, params: Optional[Dict] = None) -> str:
        """Generate cache key from URL and parameters."""
        key_parts = [url]
        if params:
            # Sort params for consistent key generation
            sorted_params = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
            key_parts.append(sorted_params)
        return "_".join(key_parts).replace("/", "_").replace(":", "_")
    
    def _get_cache_file(self, cache_key: str) -> Path:
        """Get cache file path for key."""
        return self.cache_dir / f"{cache_key}.json"
    
    def _read_cache(self, cache_key: str) -> Optional[CacheEntry]:
        """Read cached data if valid."""
        cache_file = self._get_cache_file(cache_key)
        if not cache_file.exists():
            return None
            
        try:
            with cache_file.open() as f:
                entry = json.load(f)
                # Check if cache is still valid
                if time.time() < entry.get("expires_at", 0):
                    return entry
        except (json.JSONDecodeError, IOError, KeyError):
            pass
            
        return None
    
    def _write_cache(self, cache_key: str, data: Any, ttl: Optional[int] = None) -> None:
        """Write data to cache."""
        if ttl is None:
            ttl = self.cache_ttl
            
        entry: CacheEntry = {
            "data": data,
            "timestamp": time.time(),
            "expires_at": time.time() + ttl,
        }
        
        cache_file = self._get_cache_file(cache_key)
        try:
            with cache_file.open("w") as f:
                json.dump(entry, f)
        except IOError:
            pass  # Cache write failure shouldn't break the application
    
    def _is_circuit_open(self) -> bool:
        """Check if circuit breaker is open."""
        if self.circuit_state == CircuitState.OPEN:
            # Check if enough time has passed to try again
            if time.time() - self.last_failure_time >= self.circuit_recovery_timeout:
                self.circuit_state = CircuitState.HALF_OPEN
                return False
            return True
        return False
    
    def _record_success(self) -> None:
        """Record successful request."""
        self.failure_count = 0
        if self.circuit_state == CircuitState.HALF_OPEN:
            self.circuit_state = CircuitState.CLOSED
    
    def _record_failure(self) -> None:
        """Record failed request and update circuit breaker."""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.circuit_failure_threshold:
            self.circuit_state = CircuitState.OPEN
    
    def get(
        self,
        endpoint: str,
        params: Optional[Dict] = None,
        cache_ttl: Optional[int] = None,
        use_cache: bool = True,
        fallback_to_stale: bool = True,
    ) -> Optional[Any]:
        """
        Make GET request with resilience features.
        
        Args:
            endpoint: API endpoint (relative to base_url)
            params: Query parameters
            cache_ttl: Override default cache TTL
            use_cache: Whether to use caching
            fallback_to_stale: Use stale cache if fresh request fails
            
        Returns:
            Response data or None if all attempts fail
        """
        url = f"{self.base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        cache_key = self._get_cache_key(url, params) if use_cache else None
        
        # Try to get fresh cached data first
        if use_cache and cache_key:
            cached_entry = self._read_cache(cache_key)
            if cached_entry:
                return cached_entry["data"]
        
        # Check circuit breaker
        if self._is_circuit_open():
            print(f"[warn] Circuit breaker OPEN for {url}")
            # Fallback to stale cache if available
            if use_cache and fallback_to_stale and cache_key:
                return self._get_stale_cache(cache_key)
            return None
        
        # Make the request
        try:
            print(f"[info] Fetching {url}")
            response = self.session.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            
            # Record success and cache result
            self._record_success()
            if use_cache and cache_key:
                self._write_cache(cache_key, data, cache_ttl)
            
            return data
            
        except requests.exceptions.RequestException as e:
            print(f"[warn] HTTP request failed for {url}: {e}")
            self._record_failure()
            
            # Fallback to stale cache
            if use_cache and fallback_to_stale and cache_key:
                stale_data = self._get_stale_cache(cache_key)
                if stale_data:
                    print(f"[info] Using stale cached data for {url}")
                    return stale_data
            
            return None
        
        except Exception as e:
            print(f"[error] Unexpected error for {url}: {e}")
            self._record_failure()
            return None
    
    def _get_stale_cache(self, cache_key: str) -> Optional[Any]:
        """Get stale cached data (ignoring expiration)."""
        cache_file = self._get_cache_file(cache_key)
        if not cache_file.exists():
            return None
            
        try:
            with cache_file.open() as f:
                entry = json.load(f)
                return entry.get("data")
        except (json.JSONDecodeError, IOError, KeyError):
            return None
    
    def clear_cache(self, max_age_hours: Optional[int] = None) -> int:
        """
        Clear cache files.
        
        Args:
            max_age_hours: Only clear files older than this (None = clear all)
            
        Returns:
            Number of files cleared
        """
        cleared = 0
        cutoff_time = time.time() - (max_age_hours * 3600) if max_age_hours else 0
        
        for cache_file in self.cache_dir.glob("*.json"):
            if max_age_hours is None or cache_file.stat().st_mtime < cutoff_time:
                try:
                    cache_file.unlink()
                    cleared += 1
                except OSError:
                    pass
                    
        return cleared
    
    def get_circuit_status(self) -> Dict[str, Any]:
        """Get current circuit breaker status."""
        return {
            "state": self.circuit_state.value,
            "failure_count": self.failure_count,
            "last_failure_time": self.last_failure_time,
            "is_open": self._is_circuit_open(),
        }
