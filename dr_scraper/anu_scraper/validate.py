"""
Validation utilities for the scraped database.
Ensures data integrity and consistency.
"""

import re
from typing import Dict, List, Optional, Any, Set, Tuple


class ValidationError:
    """A validation error with details."""

    def __init__(self, error_type: str, message: str, context: Dict[str, Any] = None):
        self.error_type = error_type
        self.message = message
        self.context = context or {}

    def __str__(self):
        return f"[{self.error_type}] {self.message}"


def validate_course(course: Dict[str, Any], all_codes: Set[str]) -> List[ValidationError]:
    """Validate a single course object."""
    errors = []
    code = course.get('code', 'UNKNOWN')

    # Required fields
    required_fields = ['code', 'name', 'units', 'level', 'college', 'semesters', 'prerequisites', 'description', 'type']
    for field in required_fields:
        if field not in course:
            errors.append(ValidationError('missing_field', f"Course {code} missing required field: {field}"))

    # Validate code format
    if not re.match(r'^[A-Z]{4}[0-9]{4}$', code):
        errors.append(ValidationError('invalid_code', f"Invalid course code format: {code}"))

    # Validate units
    units = course.get('units', 0)
    if not isinstance(units, int) or units < 0 or units > 24:
        errors.append(ValidationError('invalid_units', f"Course {code} has invalid units: {units}"))

    # Validate level
    level = course.get('level', 0)
    if level not in [1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000]:
        errors.append(ValidationError('invalid_level', f"Course {code} has invalid level: {level}"))

    # Validate semesters
    valid_semesters = {'S1', 'S2', 'Summer', 'Full Year'}
    semesters = course.get('semesters', [])
    for sem in semesters:
        if sem not in valid_semesters:
            errors.append(ValidationError('invalid_semester', f"Course {code} has invalid semester: {sem}"))

    # Validate type
    valid_types = {'foundation', 'core', 'professionalCore', 'major', 'elective', 'engnElective', 'capstone', 'industryExperience'}
    course_type = course.get('type', '')
    if course_type not in valid_types:
        errors.append(ValidationError('invalid_type', f"Course {code} has invalid type: {course_type}"))

    # Validate prerequisites exist
    for prereq in course.get('prerequisites', []):
        if prereq not in all_codes:
            errors.append(ValidationError('missing_prereq', f"Course {code} has prerequisite {prereq} not in database"))

    # Validate corequisites exist
    for coreq in course.get('corequisites', []):
        if coreq not in all_codes:
            errors.append(ValidationError('missing_coreq', f"Course {code} has corequisite {coreq} not in database"))

    # Validate incompatible exist
    for incomp in course.get('incompatible', []):
        if incomp not in all_codes:
            errors.append(ValidationError('missing_incomp', f"Course {code} has incompatible {incomp} not in database"))

    # Validate prerequisiteAlternatives
    prereq_alts = course.get('prerequisiteAlternatives', [])
    if prereq_alts:
        for alt_group in prereq_alts:
            if not isinstance(alt_group, list):
                errors.append(ValidationError('invalid_alt_format', f"Course {code} has invalid prerequisiteAlternatives format"))
            else:
                for prereq in alt_group:
                    if prereq not in all_codes:
                        errors.append(ValidationError('missing_prereq_alt', f"Course {code} has alternative prereq {prereq} not in database"))

    return errors


def validate_major(major: Dict[str, Any], all_codes: Set[str]) -> List[ValidationError]:
    """Validate a major object."""
    errors = []
    code = major.get('code', 'UNKNOWN')

    # Required fields
    required_fields = ['code', 'name', 'units', 'allCourses']
    for field in required_fields:
        if field not in major:
            errors.append(ValidationError('missing_field', f"Major {code} missing required field: {field}"))

    # Validate all courses exist
    for course_code in major.get('allCourses', []):
        if course_code not in all_codes:
            errors.append(ValidationError('missing_course', f"Major {code} references course {course_code} not in database"))

    return errors


def validate_program(program: Dict[str, Any], major_codes: Set[str], course_codes: Set[str]) -> List[ValidationError]:
    """Validate a program object."""
    errors = []
    code = program.get('code', 'UNKNOWN')

    # Required fields
    required_fields = ['code', 'name', 'totalUnits', 'duration', 'majors']
    for field in required_fields:
        if field not in program:
            errors.append(ValidationError('missing_field', f"Program {code} missing required field: {field}"))

    # Validate majors exist
    for major_code in program.get('majors', []):
        if major_code not in major_codes:
            errors.append(ValidationError('missing_major', f"Program {code} references major {major_code} not in database"))

    return errors


def find_circular_prerequisites(courses: Dict[str, Dict]) -> List[Tuple[str, List[str]]]:
    """Find any circular prerequisite chains."""
    circular = []

    def find_cycle(code: str, visited: Set[str], path: List[str]) -> Optional[List[str]]:
        if code in visited:
            # Found a cycle
            cycle_start = path.index(code)
            return path[cycle_start:] + [code]

        if code not in courses:
            return None

        visited.add(code)
        path.append(code)

        course = courses[code]
        prereqs = course.get('prerequisites', [])

        for prereq in prereqs:
            cycle = find_cycle(prereq, visited.copy(), path.copy())
            if cycle:
                return cycle

        return None

    for code in courses:
        cycle = find_cycle(code, set(), [])
        if cycle:
            circular.append((code, cycle))

    return circular


def validate_database(data: Dict[str, Any]) -> List[ValidationError]:
    """
    Validate the complete scraped database.

    Args:
        data: Complete database with 'courses', 'majors', 'program' keys

    Returns:
        List of validation errors
    """
    errors = []

    courses = data.get('courses', {})
    majors = data.get('majors', {})
    program = data.get('program', {})

    # Get all course codes
    all_course_codes = set(courses.keys())

    # Validate each course
    for code, course in courses.items():
        course_errors = validate_course(course, all_course_codes)
        errors.extend(course_errors)

    # Validate each major
    major_codes = set(majors.keys())
    for code, major in majors.items():
        major_errors = validate_major(major, all_course_codes)
        errors.extend(major_errors)

    # Validate program
    if program:
        program_errors = validate_program(program, major_codes, all_course_codes)
        errors.extend(program_errors)

    # Check for circular prerequisites
    circular = find_circular_prerequisites(courses)
    for code, cycle in circular:
        errors.append(ValidationError('circular_prereq', f"Circular prerequisite chain detected: {' -> '.join(cycle)}"))

    return errors


def validate_json_file(filepath: str) -> Tuple[bool, List[ValidationError]]:
    """
    Validate a JSON database file.

    Returns:
        Tuple of (is_valid, errors)
    """
    import json

    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return False, [ValidationError('invalid_json', f"Invalid JSON: {e}")]
    except FileNotFoundError:
        return False, [ValidationError('file_not_found', f"File not found: {filepath}")]

    errors = validate_database(data)
    return len(errors) == 0, errors
