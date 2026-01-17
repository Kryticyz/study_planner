"""
Major scraper for ANU major pages.
Extracts structured major data including requirements and course lists.
"""

import re
from typing import Dict, List, Optional, Any, Tuple
from bs4 import BeautifulSoup, Tag

from .prerequisites import extract_course_codes


def extract_requirement_groups(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    """
    Extract requirement groups from a major/program page.

    Returns list of requirement groups, each containing:
    - type: 'compulsory', 'choose', 'elective', 'subject_area'
    - units: number of units
    - description: text description
    - courses: list of course codes
    """
    requirements = []

    # Look for requirement sections
    req_sections = soup.find_all(['div', 'section'], class_=re.compile('requirement|course-list', re.I))

    for section in req_sections:
        req_group = parse_requirement_section(section)
        if req_group and req_group.get('courses'):
            requirements.append(req_group)

    # Also look for structured requirement lists
    req_lists = soup.find_all('ul', class_=re.compile('course|requirement', re.I))
    for ul in req_lists:
        courses = []
        for li in ul.find_all('li'):
            codes = extract_course_codes(li.get_text())
            courses.extend(codes)

        if courses:
            requirements.append({
                'type': 'compulsory',
                'courses': list(set(courses)),
            })

    # If no structured requirements found, extract all course codes
    if not requirements:
        all_courses = extract_all_course_codes(soup)
        if all_courses:
            requirements.append({
                'type': 'compulsory',
                'courses': all_courses,
            })

    return requirements


def parse_requirement_section(section: Tag) -> Optional[Dict[str, Any]]:
    """Parse a single requirement section."""
    text = section.get_text()
    text_lower = text.lower()

    # Determine requirement type
    if 'compulsory' in text_lower or 'required' in text_lower:
        req_type = 'compulsory'
    elif 'choose' in text_lower or 'select' in text_lower or 'one of' in text_lower:
        req_type = 'choose'
    elif 'elective' in text_lower:
        req_type = 'elective'
    elif 'subject area' in text_lower or 'engn' in text_lower.split():
        req_type = 'subject_area'
    else:
        req_type = 'compulsory'

    # Extract units
    units_match = re.search(r'(\d+)\s*units?', text_lower)
    units = int(units_match.group(1)) if units_match else None

    # Extract course codes
    courses = extract_course_codes(text)

    # Extract course links for more accurate list
    course_links = section.find_all('a', href=re.compile(r'/course/'))
    if course_links:
        courses = []
        for link in course_links:
            href = link.get('href', '')
            match = re.search(r'/course/([A-Z]{4}[0-9]{4})', href)
            if match:
                courses.append(match.group(1))

    if not courses:
        return None

    result = {
        'type': req_type,
        'courses': list(set(courses)),
    }

    if units:
        result['units'] = units

    # Get description
    header = section.find(['h2', 'h3', 'h4', 'strong'])
    if header:
        result['description'] = header.get_text(strip=True)

    return result


def extract_all_course_codes(soup: BeautifulSoup) -> List[str]:
    """Extract all course codes from the page, prioritizing linked courses."""
    courses = set()

    # First, get all linked courses
    for link in soup.find_all('a', href=re.compile(r'/course/')):
        href = link.get('href', '')
        match = re.search(r'/course/([A-Z]{4}[0-9]{4})', href)
        if match:
            courses.add(match.group(1))

    # Then add any mentioned in text
    text = soup.get_text()
    courses.update(extract_course_codes(text))

    return list(courses)


def scrape_major(soup: BeautifulSoup, code: str, year: int) -> Optional[Dict[str, Any]]:
    """
    Scrape major data from a major page.

    Args:
        soup: Parsed HTML of major page
        code: Major code (e.g., 'ECSY-MAJ')
        year: Academic year

    Returns:
        Major data dictionary
    """
    try:
        # Extract major name from h1
        h1 = soup.find('h1')
        name = h1.get_text(strip=True) if h1 else code

        # Extract units
        units = 48  # Default for majors
        units_text = soup.find(string=re.compile(r'\d+\s*units?', re.I))
        if units_text:
            match = re.search(r'(\d+)\s*units?', str(units_text), re.I)
            if match:
                units = int(match.group(1))

        # Extract requirements
        requirements = extract_requirement_groups(soup)

        # Get all courses
        all_courses = set()
        for req in requirements:
            all_courses.update(req.get('courses', []))

        # Also extract any additional linked courses
        all_courses.update(extract_all_course_codes(soup))

        # Build major object
        major = {
            'code': code,
            'name': name,
            'units': units,
            'requirements': requirements,
            'allCourses': sorted(list(all_courses)),
        }

        return major

    except Exception as e:
        print(f"Error scraping major {code}: {e}")
        return None


def extract_major_codes(soup: BeautifulSoup) -> List[str]:
    """Extract all major codes from a program page."""
    major_codes = set()

    # Look for major links
    for link in soup.find_all('a', href=re.compile(r'/major/')):
        href = link.get('href', '')
        match = re.search(r'/major/([A-Za-z0-9-]+)', href)
        if match:
            major_codes.add(match.group(1).upper())

    # Also look for major codes in text
    text = soup.get_text()
    pattern = re.compile(r'\b([A-Z]{4}-MAJ)\b')
    major_codes.update(pattern.findall(text))

    return sorted(list(major_codes))
