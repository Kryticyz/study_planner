"""
Course scraper for ANU course pages.
Extracts structured course data matching the application's Course interface.
"""

import re
from typing import Dict, List, Optional, Any
from bs4 import BeautifulSoup, Tag

from .prerequisites import parse_prerequisite_text, extract_course_codes


# Semester patterns
SEMESTER_PATTERNS = {
    'semester 1': 'S1',
    'first semester': 'S1',
    's1': 'S1',
    'semester 2': 'S2',
    'second semester': 'S2',
    's2': 'S2',
    'summer': 'Summer',
    'summer session': 'Summer',
    'full year': 'Full Year',
    'full-year': 'Full Year',
}

# Course type mapping based on code patterns and descriptions
COURSE_TYPE_PATTERNS = {
    'foundation': [r'MATH1\d{3}', r'PHYS1\d{3}', r'COMP1\d{3}', r'ENGN1\d{3}'],
    'core': [r'ENGN2\d{3}'],
    'capstone': [r'ENGN4300'],
}


def extract_level(code: str) -> int:
    """Extract course level from course code (e.g., ENGN2218 -> 2000)."""
    match = re.search(r'[A-Z]{4}(\d)\d{3}', code)
    if match:
        return int(match.group(1)) * 1000
    return 1000


def extract_college(subject: str) -> str:
    """Map subject code to college name."""
    college_map = {
        'ENGN': 'Engineering',
        'MATH': 'Science',
        'PHYS': 'Science',
        'COMP': 'Computing',
        'STAT': 'Science',
        'CHEM': 'Science',
        'BIOL': 'Science',
        'ECON': 'Business',
        'FINM': 'Business',
        'LAWS': 'Law',
        'POLS': 'Arts',
        'PHIL': 'Arts',
    }

    # Extract subject prefix from the subject string
    for prefix, college in college_map.items():
        if prefix in subject.upper():
            return college

    return subject if subject else 'Unknown'


def parse_semesters(offered_text: str) -> List[str]:
    """Parse 'Offered in' text into semester codes."""
    if not offered_text:
        return []

    offered_lower = offered_text.lower()
    semesters = []

    for pattern, code in SEMESTER_PATTERNS.items():
        if pattern in offered_lower and code not in semesters:
            semesters.append(code)

    # Handle year patterns like "2025 Semester 1, Semester 2"
    if not semesters:
        if 'semester 1' in offered_lower or ', 1' in offered_lower:
            semesters.append('S1')
        if 'semester 2' in offered_lower or ', 2' in offered_lower:
            semesters.append('S2')

    return semesters if semesters else ['S1']  # Default to S1 if unclear


def parse_semester_pattern(offered_text: str) -> Optional[str]:
    """Detect if course is only offered in odd or even years."""
    if not offered_text:
        return None

    offered_lower = offered_text.lower()

    if 'odd year' in offered_lower:
        return 'odd_years_only'
    elif 'even year' in offered_lower:
        return 'even_years_only'

    return None


def extract_sidebar_field(soup: BeautifulSoup, field_name: str) -> Optional[str]:
    """Extract a field value from the sidebar using ANU's actual page structure."""
    # ANU uses a structure like:
    # <li>* Code [MATH1013](/2026/course/MATH1013)</li>
    # <li>* Unit Value 6 units</li>
    # <li>* Offered in First Semester 2026...</li>

    all_text = soup.get_text()

    # Pattern 1: "Field Name\n  Value" or "Field Name Value"
    patterns = [
        rf'{field_name}\s*\n\s*([^\n*]+)',  # Field on one line, value on next
        rf'{field_name}\s+([^\n*]+)',        # Field and value on same line
        rf'\*\s*{field_name}\s+([^\n*]+)',   # With bullet point
    ]

    for pattern in patterns:
        match = re.search(pattern, all_text, re.I)
        if match:
            value = match.group(1).strip()
            # Clean up the value
            value = re.sub(r'\s+', ' ', value)
            if value:
                return value

    # Try finding in list items
    for li in soup.find_all('li'):
        text = li.get_text(strip=True)
        if field_name.lower() in text.lower():
            # Extract value after the field name
            parts = re.split(field_name, text, flags=re.I)
            if len(parts) > 1:
                return parts[1].strip()

    return None


def extract_offered_semesters(soup: BeautifulSoup) -> str:
    """Extract the 'Offered in' field specifically."""
    all_text = soup.get_text()

    # Look for "Offered in" followed by semester info
    match = re.search(r'Offered\s+in\s*\n?\s*([^\n]+(?:\n[^\n*]+)?)', all_text, re.I)
    if match:
        return match.group(1).strip()

    # Try finding in the structured data
    for text in all_text.split('\n'):
        if 'offered in' in text.lower():
            return text

    return ""


def determine_course_type(code: str, name: str, description: str, level: int) -> str:
    """Determine the course type based on code, name, and level."""
    code_upper = code.upper()

    # Check explicit patterns
    if code_upper == 'ENGN4300':
        return 'capstone'

    if code_upper == 'ENGN3100':
        return 'industryExperience'

    # Check by level and prefix
    if level == 1000:
        return 'foundation'

    if code_upper.startswith('ENGN'):
        if level == 2000:
            return 'core'
        elif level >= 3000:
            # Could be major or elective
            return 'major'

    return 'elective'


def _filter_self_from_expression(expr: Optional[Dict], self_code: str) -> Optional[Dict]:
    """Remove self-references from a prerequisite expression tree."""
    if not expr:
        return None

    if expr.get('type') == 'course':
        if expr.get('courseCode') == self_code:
            return None
        return expr

    if expr.get('type') in ('and', 'or'):
        operands = expr.get('operands', [])
        filtered = [_filter_self_from_expression(op, self_code) for op in operands]
        filtered = [op for op in filtered if op is not None]

        if not filtered:
            return None
        if len(filtered) == 1:
            return filtered[0]
        return {'type': expr['type'], 'operands': filtered}

    # For unitLevel or other types, return as-is
    return expr


def scrape_course(soup: BeautifulSoup, code: str, year: int) -> Optional[Dict[str, Any]]:
    """
    Scrape course data from a course page.

    Args:
        soup: Parsed HTML of course page
        code: Course code
        year: Academic year

    Returns:
        Course data dictionary matching the Course interface
    """
    try:
        # Extract course name from meta tag (ANU uses <meta name="course-name" content="...">)
        name_meta = soup.find('meta', attrs={'name': 'course-name'})
        if name_meta and name_meta.get('content'):
            name = name_meta['content'].strip()
        else:
            # Fallback to h1
            h1 = soup.find('h1')
            name = h1.get_text(strip=True) if h1 else code

        # Clean up name - remove code if it's included
        name = re.sub(f'^{code}\\s*[-–:]?\\s*', '', name)

        # Extract units
        units_text = extract_sidebar_field(soup, 'Unit')
        units = 6  # Default
        if units_text:
            match = re.search(r'(\d+)', units_text)
            if match:
                units = int(match.group(1))

        # Extract level
        level = extract_level(code)

        # Extract college/subject
        subject_text = extract_sidebar_field(soup, 'Subject') or extract_sidebar_field(soup, 'Course Subject')
        college = extract_college(subject_text or code[:4])

        # Extract semesters offered
        offered_text = extract_offered_semesters(soup) or extract_sidebar_field(soup, 'Offered')
        semesters = parse_semesters(offered_text or '')
        semester_pattern = parse_semester_pattern(offered_text or '')

        # Extract prerequisites from the requisite div (ANU uses <div class="requisite">)
        prereq_text = ""

        # Primary method: Look for the requisite div
        requisite_div = soup.find('div', class_='requisite')
        if requisite_div:
            # Use separator=' ' to preserve spaces between elements (important for course code extraction)
            prereq_text = requisite_div.get_text(separator=' ', strip=True)
        else:
            # Fallback: Look for the "Requisite and Incompatibility" section in text
            all_text = soup.get_text()
            req_match = re.search(
                r'Requisite\s+and\s+Incompatibility[^\n]*\n(.*?)(?:Prescribed\s+Texts|Other\s+Information|Workload|$)',
                all_text, re.I | re.DOTALL
            )
            if req_match:
                prereq_text = req_match.group(1).strip()

        # Parse prerequisites
        prereq_data = parse_prerequisite_text(prereq_text)

        # Filter out self-references (course can't be its own prerequisite)
        prereq_data.prerequisites = [c for c in prereq_data.prerequisites if c != code]
        if prereq_data.prerequisiteAlternatives:
            prereq_data.prerequisiteAlternatives = [
                [c for c in alt if c != code] for alt in prereq_data.prerequisiteAlternatives
            ]
            prereq_data.prerequisiteAlternatives = [alt for alt in prereq_data.prerequisiteAlternatives if alt]
        if prereq_data.prerequisiteExpression:
            prereq_data.prerequisiteExpression = _filter_self_from_expression(prereq_data.prerequisiteExpression, code)

        # Extract description from meta tag (ANU uses <meta name="course-description" content="...">)
        description = ""
        desc_meta = soup.find('meta', attrs={'name': 'course-description'})
        if desc_meta and desc_meta.get('content'):
            # The content may contain HTML tags, parse them
            desc_html = desc_meta['content']
            desc_soup = BeautifulSoup(desc_html, 'html.parser')
            description = desc_soup.get_text(strip=True)
        else:
            # Fallback: Look for description div
            desc_section = soup.find(['div', 'section'], class_=re.compile('description|content|overview', re.I))
            if desc_section:
                paragraphs = desc_section.find_all('p')
                if paragraphs:
                    description = ' '.join(p.get_text(strip=True) for p in paragraphs[:2])
            else:
                # Try finding first substantial paragraph
                for p in soup.find_all('p'):
                    text = p.get_text(strip=True)
                    if len(text) > 50 and code not in text:
                        description = text
                        break

        if not description:
            description = f"Course {code}"

        # Determine course type
        course_type = determine_course_type(code, name, description, level)

        # Check for STEM badge
        stem_course = soup.find(string=re.compile('STEM Course', re.I)) is not None

        # Build course object
        course: Dict[str, Any] = {
            'code': code,
            'name': name,
            'units': units,
            'level': level,
            'college': college,
            'semesters': semesters,
            'prerequisites': prereq_data.prerequisites,
            'description': description[:500],  # Truncate long descriptions
            'type': course_type,
        }

        # Add optional fields if present
        if prereq_data.prerequisiteAlternatives:
            course['prerequisiteAlternatives'] = prereq_data.prerequisiteAlternatives

        if prereq_data.corequisites:
            course['corequisites'] = prereq_data.corequisites

        if prereq_data.incompatible:
            course['incompatible'] = prereq_data.incompatible

        if prereq_data.assumedKnowledge:
            course['assumedKnowledge'] = prereq_data.assumedKnowledge

        if prereq_data.prerequisiteExpression:
            course['prerequisiteExpression'] = prereq_data.prerequisiteExpression

        if semester_pattern:
            course['semesterPattern'] = semester_pattern

        if semesters == ['Full Year'] or units == 12:
            course['semesterSpan'] = 2

        if course_type == 'capstone':
            course['honoursWeight'] = 0.4

        return course

    except Exception as e:
        print(f"Error scraping course {code}: {e}")
        return None


def get_all_course_codes_from_soup(soup: BeautifulSoup) -> List[str]:
    """Extract all course codes mentioned in a page."""
    text = soup.get_text()
    return list(set(extract_course_codes(text)))
