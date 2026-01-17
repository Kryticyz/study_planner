"""
Cache utilities for ANU scraper.
Caches HTML responses to disk to avoid redundant requests.
"""

import os
import hashlib
import time
from pathlib import Path
from typing import Optional


class HTMLCache:
    """File-based cache for HTML responses."""

    def __init__(self, cache_dir: str = "./cache", enabled: bool = True):
        self.cache_dir = Path(cache_dir)
        self.enabled = enabled
        if enabled:
            self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_path(self, year: int, page_type: str, code: str) -> Path:
        """Get the cache file path for a given page."""
        # Sanitize code for filesystem
        safe_code = code.replace("/", "_").replace("\\", "_")
        return self.cache_dir / str(year) / page_type / f"{safe_code}.html"

    def get(self, year: int, page_type: str, code: str) -> Optional[str]:
        """Retrieve cached HTML if it exists."""
        if not self.enabled:
            return None

        cache_path = self._get_cache_path(year, page_type, code)
        if cache_path.exists():
            try:
                return cache_path.read_text(encoding="utf-8")
            except Exception:
                return None
        return None

    def set(self, year: int, page_type: str, code: str, html: str) -> None:
        """Store HTML in cache."""
        if not self.enabled:
            return

        cache_path = self._get_cache_path(year, page_type, code)
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(html, encoding="utf-8")

    def exists(self, year: int, page_type: str, code: str) -> bool:
        """Check if a cached version exists."""
        if not self.enabled:
            return False
        return self._get_cache_path(year, page_type, code).exists()

    def clear(self, year: Optional[int] = None) -> int:
        """Clear cache. If year specified, only clear that year."""
        if not self.enabled or not self.cache_dir.exists():
            return 0

        count = 0
        if year:
            year_dir = self.cache_dir / str(year)
            if year_dir.exists():
                for f in year_dir.rglob("*.html"):
                    f.unlink()
                    count += 1
        else:
            for f in self.cache_dir.rglob("*.html"):
                f.unlink()
                count += 1
        return count


class RateLimiter:
    """Simple rate limiter with exponential backoff."""

    def __init__(self, min_delay: float = 1.0, max_delay: float = 30.0):
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.last_request_time = 0.0
        self.consecutive_failures = 0

    def wait(self) -> None:
        """Wait appropriate time before next request."""
        elapsed = time.time() - self.last_request_time
        delay = self.min_delay * (2 ** self.consecutive_failures)
        delay = min(delay, self.max_delay)

        if elapsed < delay:
            time.sleep(delay - elapsed)

        self.last_request_time = time.time()

    def success(self) -> None:
        """Record a successful request."""
        self.consecutive_failures = 0

    def failure(self) -> None:
        """Record a failed request."""
        self.consecutive_failures += 1
