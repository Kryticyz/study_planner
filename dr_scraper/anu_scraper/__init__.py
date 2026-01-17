"""
ANU Course Database Scraper

A web scraper that builds a complete course database for ANU degree programs.
Outputs data in a structured format compatible with study planning applications.
"""

__version__ = "1.0.0"

from .cache import HTMLCache, RateLimiter
from .fetcher import ANUFetcher
from .prerequisites import parse_prerequisite_text, extract_course_codes, ParsedPrerequisites
from .course import scrape_course, extract_level, parse_semesters
from .major import scrape_major, extract_major_codes
from .program import scrape_program
from .validate import validate_database, validate_json_file, ValidationError

__all__ = [
    'HTMLCache',
    'RateLimiter',
    'ANUFetcher',
    'parse_prerequisite_text',
    'extract_course_codes',
    'ParsedPrerequisites',
    'scrape_course',
    'scrape_major',
    'scrape_program',
    'extract_level',
    'parse_semesters',
    'extract_major_codes',
    'validate_database',
    'validate_json_file',
    'ValidationError',
]
