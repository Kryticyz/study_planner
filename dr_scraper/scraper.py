#!/usr/bin/env python3
"""
ANU Course Database Scraper

Builds a complete course database for any ANU degree program.
Outputs JSON matching the study planning application's data structures.

Usage:
    python anu_scraper.py <program_code> --year <year> --output <file.json>
    python anu_scraper.py aengi --year 2026 --output engineering_2026.json
    python anu_scraper.py --courses ENGN4339,MATH1013 --year 2026 --output courses.json
    python anu_scraper.py --validate database.json
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from typing import Dict, List, Set, Any

from anu_scraper import (
    HTMLCache,
    RateLimiter,
    ANUFetcher,
    scrape_course,
    scrape_major,
    scrape_program,
    extract_major_codes,
    extract_course_codes,
    validate_database,
    validate_json_file,
)


def collect_all_course_codes(
    program_data: Dict,
    majors_data: Dict[str, Dict],
    courses_data: Dict[str, Dict]
) -> Set[str]:
    """Collect all course codes from program, majors, and existing courses."""
    codes = set()

    # From program
    if program_data:
        codes.update(program_data.get('allCourses', []))
        for req in program_data.get('requirements', []):
            codes.update(req.get('courses', []))

    # From majors
    for major in majors_data.values():
        codes.update(major.get('allCourses', []))
        for req in major.get('requirements', []):
            codes.update(req.get('courses', []))

    # Prerequisites from scraped courses
    for course in courses_data.values():
        codes.update(course.get('prerequisites', []))
        codes.update(course.get('corequisites', []))
        codes.update(course.get('incompatible', []))
        for alt in course.get('prerequisiteAlternatives', []):
            codes.update(alt)

    return codes


def scrape_program_full(
    fetcher: ANUFetcher,
    program_code: str,
    year: int,
    verbose: bool = True
) -> Dict[str, Any]:
    """
    Fully scrape a program including all majors and courses.

    Args:
        fetcher: ANUFetcher instance
        program_code: Program code (e.g., 'aengi')
        year: Academic year
        verbose: Print progress messages

    Returns:
        Complete database with program, majors, and courses
    """
    if verbose:
        print(f"Scraping program: {program_code} for year {year}")

    # Step 1: Fetch and parse program page
    program_soup = fetcher.fetch_program(year, program_code)
    if not program_soup:
        print(f"ERROR: Could not fetch program page for {program_code}", file=sys.stderr)
        return {}

    program_data = scrape_program(program_soup, program_code, year)
    if verbose:
        print(f"  Found program: {program_data.get('name', 'Unknown')}")
        print(f"  Majors: {program_data.get('majors', [])}")

    # Step 2: Fetch and parse each major
    majors_data = {}
    major_codes = program_data.get('majors', [])

    if verbose:
        print(f"\nScraping {len(major_codes)} majors...")

    for major_code in major_codes:
        if verbose:
            print(f"  Fetching major: {major_code}")

        major_soup = fetcher.fetch_major(year, major_code)
        if major_soup:
            major_data = scrape_major(major_soup, major_code, year)
            if major_data:
                majors_data[major_code] = major_data
                if verbose:
                    print(f"    Found {len(major_data.get('allCourses', []))} courses in major")
        else:
            print(f"  WARNING: Could not fetch major {major_code}", file=sys.stderr)

    # Step 3: Collect all course codes to fetch
    courses_data = {}
    codes_to_fetch = collect_all_course_codes(program_data, majors_data, courses_data)
    fetched_codes = set()

    if verbose:
        print(f"\nScraping courses (initial count: {len(codes_to_fetch)})...")

    # Step 4: Fetch courses iteratively (including prerequisites)
    iteration = 0
    max_iterations = 10  # Prevent infinite loops

    while codes_to_fetch - fetched_codes and iteration < max_iterations:
        iteration += 1
        pending = codes_to_fetch - fetched_codes

        if verbose:
            print(f"  Iteration {iteration}: {len(pending)} courses to fetch")

        for code in sorted(pending):
            fetched_codes.add(code)

            course_soup = fetcher.fetch_course(year, code)
            if course_soup:
                course_data = scrape_course(course_soup, code, year)
                if course_data:
                    courses_data[code] = course_data

                    # Add new prerequisites to fetch list
                    codes_to_fetch.update(course_data.get('prerequisites', []))
                    for alt in course_data.get('prerequisiteAlternatives', []):
                        codes_to_fetch.update(alt)

        if verbose:
            print(f"    Scraped {len(courses_data)} courses so far")

    # Step 5: Build output
    result = {
        'metadata': {
            'program': program_code.upper(),
            'year': year,
            'scrapedAt': datetime.now(timezone.utc).isoformat(),
            'stats': {
                'programs': 1,
                'majors': len(majors_data),
                'courses': len(courses_data),
            }
        },
        'program': program_data,
        'majors': majors_data,
        'courses': courses_data,
    }

    return result


def scrape_courses_only(
    fetcher: ANUFetcher,
    course_codes: List[str],
    year: int,
    include_prereqs: bool = True,
    verbose: bool = True
) -> Dict[str, Any]:
    """
    Scrape specific courses and optionally their prerequisites.

    Args:
        fetcher: ANUFetcher instance
        course_codes: List of course codes to scrape
        year: Academic year
        include_prereqs: Whether to also fetch prerequisites
        verbose: Print progress messages

    Returns:
        Database with courses only
    """
    courses_data = {}
    codes_to_fetch = set(course_codes)
    fetched_codes = set()

    if verbose:
        print(f"Scraping {len(codes_to_fetch)} courses...")

    iteration = 0
    max_iterations = 10 if include_prereqs else 1

    while codes_to_fetch - fetched_codes and iteration < max_iterations:
        iteration += 1
        pending = codes_to_fetch - fetched_codes

        for code in sorted(pending):
            fetched_codes.add(code)

            if verbose:
                print(f"  Fetching: {code}")

            course_soup = fetcher.fetch_course(year, code)
            if course_soup:
                course_data = scrape_course(course_soup, code, year)
                if course_data:
                    courses_data[code] = course_data

                    if include_prereqs:
                        codes_to_fetch.update(course_data.get('prerequisites', []))
                        for alt in course_data.get('prerequisiteAlternatives', []):
                            codes_to_fetch.update(alt)

    result = {
        'metadata': {
            'year': year,
            'scrapedAt': datetime.now(timezone.utc).isoformat(),
            'stats': {
                'courses': len(courses_data),
            }
        },
        'courses': courses_data,
    }

    return result


def main():
    parser = argparse.ArgumentParser(
        description='ANU Course Database Scraper',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python anu_scraper.py aengi --year 2026 --output engineering_2026.json
  python anu_scraper.py --courses ENGN4339,MATH1013 --year 2026 --output courses.json
  python anu_scraper.py --validate database.json
        '''
    )

    parser.add_argument(
        'program',
        nargs='?',
        help='Program code to scrape (e.g., aengi)'
    )
    parser.add_argument(
        '--courses',
        type=str,
        help='Comma-separated list of course codes to scrape'
    )
    parser.add_argument(
        '--year',
        type=int,
        default=2026,
        help='Academic year (default: 2026)'
    )
    parser.add_argument(
        '--output', '-o',
        type=str,
        default='database.json',
        help='Output JSON file (default: database.json)'
    )
    parser.add_argument(
        '--no-cache',
        action='store_true',
        help='Disable caching (always fetch fresh)'
    )
    parser.add_argument(
        '--cache-dir',
        type=str,
        default='./cache',
        help='Cache directory (default: ./cache)'
    )
    parser.add_argument(
        '--validate',
        type=str,
        metavar='FILE',
        help='Validate an existing database file'
    )
    parser.add_argument(
        '--update',
        type=str,
        metavar='FILE',
        help='Update an existing database (only fetch new/changed)'
    )
    parser.add_argument(
        '--no-prereqs',
        action='store_true',
        help='Do not recursively fetch prerequisites'
    )
    parser.add_argument(
        '--quiet', '-q',
        action='store_true',
        help='Suppress progress output'
    )

    args = parser.parse_args()

    # Validation mode
    if args.validate:
        print(f"Validating: {args.validate}")
        is_valid, errors = validate_json_file(args.validate)

        if is_valid:
            print("✓ Database is valid!")
            return 0
        else:
            print(f"✗ Found {len(errors)} validation errors:")
            for error in errors[:20]:  # Show first 20
                print(f"  - {error}")
            if len(errors) > 20:
                print(f"  ... and {len(errors) - 20} more errors")
            return 1

    # Need either program or courses
    if not args.program and not args.courses:
        parser.error("Must specify either a program code or --courses")

    # Set up fetcher
    cache = HTMLCache(cache_dir=args.cache_dir, enabled=not args.no_cache)
    rate_limiter = RateLimiter(min_delay=1.0, max_delay=30.0)
    fetcher = ANUFetcher(cache=cache, rate_limiter=rate_limiter)

    verbose = not args.quiet

    # Scrape
    if args.courses:
        # Scrape specific courses
        course_codes = [c.strip().upper() for c in args.courses.split(',')]
        result = scrape_courses_only(
            fetcher,
            course_codes,
            args.year,
            include_prereqs=not args.no_prereqs,
            verbose=verbose
        )
    else:
        # Scrape full program
        result = scrape_program_full(
            fetcher,
            args.program.lower(),
            args.year,
            verbose=verbose
        )

    if not result:
        print("ERROR: Scraping failed", file=sys.stderr)
        return 1

    # Validate
    if verbose:
        print("\nValidating database...")

    errors = validate_database(result)
    warnings = [e for e in errors if 'missing' in e.error_type]
    critical = [e for e in errors if 'missing' not in e.error_type]

    if verbose:
        if not errors:
            print("  ✓ All validations passed")
        else:
            print(f"  ⚠ {len(warnings)} warnings, {len(critical)} critical errors")
            for error in critical[:5]:
                print(f"    - {error}")

    # Write output
    with open(args.output, 'w') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    if verbose:
        print(f"\nOutput written to: {args.output}")
        stats = result.get('metadata', {}).get('stats', {})
        print(f"  Programs: {stats.get('programs', 0)}")
        print(f"  Majors: {stats.get('majors', 0)}")
        print(f"  Courses: {stats.get('courses', 0)}")

    return 0


if __name__ == '__main__':
    sys.exit(main())
