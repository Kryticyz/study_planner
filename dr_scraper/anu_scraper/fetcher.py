"""
HTTP fetcher for ANU website with rate limiting and caching.
"""

import requests
import time
import sys
from typing import Optional, Tuple
from bs4 import BeautifulSoup

from .cache import HTMLCache, RateLimiter


class ANUFetcher:
    """Fetches pages from the ANU Programs and Courses website."""

    BASE_URL = "https://programsandcourses.anu.edu.au"

    def __init__(
        self,
        cache: Optional[HTMLCache] = None,
        rate_limiter: Optional[RateLimiter] = None,
        max_retries: int = 3,
        timeout: int = 30
    ):
        self.cache = cache or HTMLCache()
        self.rate_limiter = rate_limiter or RateLimiter()
        self.max_retries = max_retries
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        })

    def _build_url(self, year: int, page_type: str, code: str) -> str:
        """Build URL for a specific page type."""
        return f"{self.BASE_URL}/{year}/{page_type}/{code}"

    def fetch_html(self, year: int, page_type: str, code: str) -> Optional[str]:
        """
        Fetch HTML for a page, using cache if available.

        Args:
            year: Academic year (e.g., 2026)
            page_type: 'program', 'major', or 'course'
            code: Page code (e.g., 'aengi', 'MATH1013')

        Returns:
            HTML content or None if fetch failed
        """
        # Check cache first
        cached = self.cache.get(year, page_type, code)
        if cached is not None:
            return cached

        # Fetch from web
        url = self._build_url(year, page_type, code)
        html = self._fetch_with_retry(url)

        if html:
            # Store in cache
            self.cache.set(year, page_type, code, html)

        return html

    def _fetch_with_retry(self, url: str) -> Optional[str]:
        """Fetch URL with retry logic."""
        for attempt in range(self.max_retries):
            try:
                self.rate_limiter.wait()

                response = self.session.get(url, timeout=self.timeout)

                if response.status_code == 200:
                    self.rate_limiter.success()
                    return response.text
                elif response.status_code == 404:
                    print(f"  [404] Not found: {url}", file=sys.stderr)
                    return None
                else:
                    print(f"  [{response.status_code}] Error fetching {url}", file=sys.stderr)
                    self.rate_limiter.failure()

            except requests.Timeout:
                print(f"  [TIMEOUT] Attempt {attempt + 1}/{self.max_retries}: {url}", file=sys.stderr)
                self.rate_limiter.failure()
            except requests.RequestException as e:
                print(f"  [ERROR] Attempt {attempt + 1}/{self.max_retries}: {e}", file=sys.stderr)
                self.rate_limiter.failure()

        print(f"  [FAILED] All retries exhausted: {url}", file=sys.stderr)
        return None

    def fetch_soup(self, year: int, page_type: str, code: str) -> Optional[BeautifulSoup]:
        """Fetch and parse HTML into BeautifulSoup."""
        html = self.fetch_html(year, page_type, code)
        if html:
            return BeautifulSoup(html, 'lxml')
        return None

    def fetch_program(self, year: int, code: str) -> Optional[BeautifulSoup]:
        """Fetch a program page."""
        return self.fetch_soup(year, 'program', code)

    def fetch_major(self, year: int, code: str) -> Optional[BeautifulSoup]:
        """Fetch a major page."""
        return self.fetch_soup(year, 'major', code)

    def fetch_course(self, year: int, code: str) -> Optional[BeautifulSoup]:
        """Fetch a course page."""
        return self.fetch_soup(year, 'course', code)
