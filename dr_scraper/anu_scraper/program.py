"""
Program scraper for ANU program pages.
Extracts structured program data including requirements and available majors.
"""

import re
from typing import Dict, List, Optional, Any
from bs4 import BeautifulSoup, Tag

from .major import extract_requirement_groups, extract_all_course_codes, extract_major_codes


def extract_sidebar_info(soup: BeautifulSoup) -> Dict[str, Any]:
    """Extract information from the program sidebar."""
    info = {}

    # Look for sidebar or aside element
    sidebar = soup.find(['aside', 'div'], class_=re.compile('sidebar|program-info|quick-facts', re.I))
    if not sidebar:
        sidebar = soup

    # Common field patterns
    field_patterns = {
        'totalUnits': [r'minimum\D*(\d+)\s*units', r'(\d+)\s*units?\s*(?:total|minimum|required)'],
        'duration': [r'length[:\s]+([^<\n]+)', r'duration[:\s]+([^<\n]+)', r'(\d+\s*year[^<\n]*)'],
        'atar': [r'atar[:\s]+(\d+)', r'selection\s*rank[:\s]+(\d+)'],
    }

    text = sidebar.get_text()

    for field, patterns in field_patterns.items():
        for pattern in patterns:
            match = re.search(pattern, text, re.I)
            if match:
                value = match.group(1).strip()
                if field in ['totalUnits', 'atar']:
                    try:
                        info[field] = int(value)
                    except ValueError:
                        pass
                else:
                    info[field] = value
                break

    return info


def scrape_program(soup: BeautifulSoup, code: str, year: int) -> Optional[Dict[str, Any]]:
    """
    Scrape program data from a program page.

    Args:
        soup: Parsed HTML of program page
        code: Program code (e.g., 'aengi')
        year: Academic year

    Returns:
        Program data dictionary
    """
    try:
        # Extract program name from h1
        h1 = soup.find('h1')
        name = h1.get_text(strip=True) if h1 else code.upper()

        # Extract sidebar info
        sidebar_info = extract_sidebar_info(soup)

        # Extract requirements
        requirements = extract_requirement_groups(soup)

        # Extract major codes
        major_codes = extract_major_codes(soup)

        # Get all course codes mentioned
        all_courses = extract_all_course_codes(soup)

        # Build program object
        program = {
            'code': code.upper(),
            'name': name,
            'totalUnits': sidebar_info.get('totalUnits', 192),
            'duration': sidebar_info.get('duration', '4 year full-time'),
            'requirements': requirements,
            'majors': major_codes,
            'allCourses': sorted(list(set(all_courses))),
        }

        if 'atar' in sidebar_info:
            program['atar'] = sidebar_info['atar']

        return program

    except Exception as e:
        print(f"Error scraping program {code}: {e}")
        return None


def categorize_requirements(requirements: List[Dict], program_name: str) -> Dict[str, Any]:
    """
    Categorize requirements into the degree requirements structure.

    Returns a structured requirements object matching the degreeRequirements format.
    """
    categorized = {
        'foundations': {
            'units': 36,
            'description': 'First-year mathematics, physics, computing, introductory engineering',
            'courses': [],
        },
        'engineeringFundamentals': {
            'units': 36,
            'description': 'Second-year core engineering courses',
            'courses': [],
        },
        'professionalCore': {
            'units': 24,
            'description': 'Systems engineering and design sequence',
            'courses': [],
        },
        'major': {
            'units': 48,
            'description': 'Discipline specialization',
            'netUnits': 36,
        },
        'capstone': {
            'units': 12,
            'description': 'Final year project',
            'courses': [],
        },
        'electives': {
            'total': 48,
            'engnElectives': 24,
            'universityElectives': 24,
            'description': '24 units ENGN-coded, 24 units any college',
        },
    }

    for req in requirements:
        courses = req.get('courses', [])
        for course in courses:
            level = int(course[4]) * 1000 if len(course) >= 5 and course[4].isdigit() else 1000

            if course == 'ENGN4300':
                categorized['capstone']['courses'].append(course)
            elif course == 'ENGN3100':
                # Industry experience - separate category
                pass
            elif level == 1000:
                categorized['foundations']['courses'].append(course)
            elif level == 2000 and course.startswith('ENGN'):
                if course in ['ENGN2300', 'ENGN2301']:
                    categorized['professionalCore']['courses'].append(course)
                else:
                    categorized['engineeringFundamentals']['courses'].append(course)
            elif level >= 3000 and course in ['ENGN3300', 'ENGN3301']:
                categorized['professionalCore']['courses'].append(course)

    # Remove duplicates
    for key in categorized:
        if 'courses' in categorized[key]:
            categorized[key]['courses'] = sorted(list(set(categorized[key]['courses'])))

    return categorized
