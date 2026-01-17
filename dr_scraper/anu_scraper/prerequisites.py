"""
Prerequisite parser for ANU course prerequisites.
Parses complex AND/OR prerequisite strings into structured format.
"""

import re
from typing import Dict, List, Optional, Any, Union, Tuple
from dataclasses import dataclass, field


# Course code pattern (e.g., MATH1013, ENGN4339)
COURSE_CODE_PATTERN = re.compile(r'\b([A-Z]{4}[0-9]{4})\b')

# Unit requirement pattern (e.g., "24 units", "48 units at 2000 level")
UNIT_PATTERN = re.compile(r'(\d+)\s*units?', re.IGNORECASE)
LEVEL_PATTERN = re.compile(r'(\d{4})\s*(?:level|or\s+higher)', re.IGNORECASE)


@dataclass
class ParsedPrerequisites:
    """Structured prerequisite data."""
    # Simple list of prerequisites (AND relationship)
    prerequisites: List[str] = field(default_factory=list)
    # OR groups - each inner list is an AND group, outer is OR
    prerequisiteAlternatives: Optional[List[List[str]]] = None
    # Corequisites (same semester or before)
    corequisites: List[str] = field(default_factory=list)
    # Incompatible courses
    incompatible: List[str] = field(default_factory=list)
    # Minimum units requirement
    minimumUnits: Optional[int] = None
    # Unit level requirement
    unitLevel: Optional[int] = None
    # Assumed knowledge text
    assumedKnowledge: Optional[str] = None
    # Advanced prerequisite expression
    prerequisiteExpression: Optional[Dict[str, Any]] = None


def extract_course_codes(text: str) -> List[str]:
    """Extract all course codes from text."""
    return list(set(COURSE_CODE_PATTERN.findall(text)))


def tokenize_prerequisite_text(text: str) -> List[str]:
    """Tokenize prerequisite text into meaningful tokens."""
    # Normalize text
    text = text.replace('\n', ' ').replace('\r', ' ')
    text = re.sub(r'\s+', ' ', text).strip()

    # Replace course codes with placeholders for parsing
    codes = extract_course_codes(text)
    for code in codes:
        text = text.replace(code, f"§{code}§")

    # Split on logical operators while keeping them
    tokens = []
    current = ""

    for char in text:
        if char in '()':
            if current.strip():
                tokens.append(current.strip())
            tokens.append(char)
            current = ""
        else:
            current += char

    if current.strip():
        tokens.append(current.strip())

    return tokens


def parse_simple_expression(text: str) -> Tuple[List[str], bool]:
    """
    Parse a simple expression without parentheses.
    Returns (course_codes, is_or_relationship)
    """
    codes = extract_course_codes(text)

    # Check for OR indicators
    text_lower = text.lower()
    has_or = ' or ' in text_lower or '/' in text

    return codes, has_or


def build_prerequisite_expression(codes: List[str], is_or: bool) -> Optional[Dict]:
    """Build a prerequisite expression object."""
    if not codes:
        return None

    if len(codes) == 1:
        return {"type": "course", "courseCode": codes[0]}

    if is_or:
        return {
            "type": "or",
            "operands": [{"type": "course", "courseCode": c} for c in codes]
        }
    else:
        return {
            "type": "and",
            "operands": [{"type": "course", "courseCode": c} for c in codes]
        }


def parse_prerequisite_text(text: str) -> ParsedPrerequisites:
    """
    Parse prerequisite text into structured format.

    Handles patterns like:
    - "MATH1013" -> prerequisites: ["MATH1013"]
    - "ENGN2218 and ENGN3338" -> prerequisites: ["ENGN2218", "ENGN3338"]
    - "COMP1100 or COMP1730" -> prerequisiteAlternatives: [["COMP1100"], ["COMP1730"]]
    - "(MATH1013 or MATH1115) and PHYS1001" -> complex expression
    - "You are not able to enrol...if you have previously completed X" -> incompatible: [X]
    """
    result = ParsedPrerequisites()

    if not text or not text.strip():
        return result

    text = text.strip()
    text_lower = text.lower()

    # Extract unit requirements
    unit_match = UNIT_PATTERN.search(text)
    if unit_match:
        result.minimumUnits = int(unit_match.group(1))

    level_match = LEVEL_PATTERN.search(text)
    if level_match:
        result.unitLevel = int(level_match.group(1))

    # Split into sections - look for sentences about incompatibility/corequisites
    prereq_text = ""
    coreq_text = ""
    incomp_text = ""

    # Split by periods and newlines
    sentences = re.split(r'[.\n]', text)

    for sentence in sentences:
        sentence_lower = sentence.lower().strip()

        # Detect incompatibility statements (ANU format)
        if any(phrase in sentence_lower for phrase in [
            'not able to enrol',
            'may not enrol',
            'cannot enrol',
            'incompatible with',
            'incompatible:',
            'incompatible ',
            'if you have previously completed',
            'cannot take together'
        ]):
            incomp_text += " " + sentence
        elif any(phrase in sentence_lower for phrase in [
            'co-requisite',
            'corequisite',
            'concurrently'
        ]):
            coreq_text += " " + sentence
        elif 'assumed knowledge' in sentence_lower or 'assumed' in sentence_lower:
            result.assumedKnowledge = sentence.strip()
        elif any(phrase in sentence_lower for phrase in [
            'must have completed',
            'prerequisite',
            'to enrol in this course you must'
        ]):
            prereq_text += " " + sentence
        else:
            # Default: treat as prerequisite text if it contains course codes
            if extract_course_codes(sentence):
                prereq_text += " " + sentence

    # Parse incompatible courses
    if incomp_text:
        result.incompatible = extract_course_codes(incomp_text)

    # Parse corequisites
    if coreq_text:
        result.corequisites = extract_course_codes(coreq_text)

    # Parse prerequisites
    prereq_text = prereq_text.strip()
    if prereq_text:
        result = _parse_prereq_expression(prereq_text, result)

    return result


def _parse_prereq_expression(text: str, result: ParsedPrerequisites) -> ParsedPrerequisites:
    """Parse the prerequisite expression with AND/OR logic."""

    # Extract all course codes
    all_codes = extract_course_codes(text)
    text_lower = text.lower()

    if not all_codes:
        return result

    # Simple case: single course
    if len(all_codes) == 1:
        result.prerequisites = all_codes
        return result

    # Check for parentheses (complex expression)
    has_parens = '(' in text and ')' in text

    # Check for mixed AND/OR
    has_and = ' and ' in text_lower
    has_or = ' or ' in text_lower or '/' in text

    if not has_and and not has_or:
        # Just a list of courses, assume AND
        result.prerequisites = all_codes
        return result

    if has_and and not has_or:
        # Pure AND relationship
        result.prerequisites = all_codes
        result.prerequisiteExpression = {
            "type": "and",
            "operands": [{"type": "course", "courseCode": c} for c in all_codes]
        }
        return result

    if has_or and not has_and:
        # Pure OR relationship
        result.prerequisites = [all_codes[0]]  # Legacy: first option
        result.prerequisiteAlternatives = [[c] for c in all_codes]
        result.prerequisiteExpression = {
            "type": "or",
            "operands": [{"type": "course", "courseCode": c} for c in all_codes]
        }
        return result

    # Mixed AND/OR - need to parse more carefully
    return _parse_complex_prereq(text, all_codes, result)


def _parse_complex_prereq(text: str, all_codes: List[str], result: ParsedPrerequisites) -> ParsedPrerequisites:
    """Parse complex prerequisite expressions with mixed AND/OR."""

    # Try to identify the structure
    # Common patterns:
    # "(A or B) and C" - OR group ANDed with single course
    # "A and (B or C)" - Single course ANDed with OR group
    # "(A or B) and (C or D)" - Two OR groups ANDed together

    text_lower = text.lower()

    # Find parenthesized groups
    paren_groups = re.findall(r'\(([^)]+)\)', text)
    non_paren = re.sub(r'\([^)]+\)', '', text)

    or_groups = []
    and_courses = []

    # Process parenthesized groups
    for group in paren_groups:
        group_codes = extract_course_codes(group)
        if ' or ' in group.lower() or '/' in group:
            # This is an OR group
            or_groups.append(group_codes)
        else:
            # AND group inside parens, add to main AND
            and_courses.extend(group_codes)

    # Process non-parenthesized codes
    non_paren_codes = extract_course_codes(non_paren)
    and_courses.extend(non_paren_codes)

    # Build the structure
    if or_groups and and_courses:
        # Mixed: (A or B) and C
        # Format for prerequisiteAlternatives:
        # Each alternative must include all AND requirements
        # So (A or B) and C becomes: [[A, C], [B, C]]
        alternatives = []
        for or_group in or_groups:
            for or_code in or_group:
                alt = [or_code] + and_courses
                alternatives.append(alt)

        result.prerequisites = alternatives[0] if alternatives else []
        result.prerequisiteAlternatives = alternatives

        # Build expression tree
        or_exprs = []
        for or_group in or_groups:
            or_exprs.append({
                "type": "or",
                "operands": [{"type": "course", "courseCode": c} for c in or_group]
            })

        and_exprs = [{"type": "course", "courseCode": c} for c in and_courses]

        all_operands = or_exprs + and_exprs
        if len(all_operands) == 1:
            result.prerequisiteExpression = all_operands[0]
        else:
            result.prerequisiteExpression = {
                "type": "and",
                "operands": all_operands
            }

    elif or_groups:
        # Multiple OR groups
        # (A or B) and (C or D) -> [[A,C], [A,D], [B,C], [B,D]]
        from itertools import product
        if len(or_groups) > 1:
            alternatives = [list(combo) for combo in product(*or_groups)]
        else:
            alternatives = [[c] for c in or_groups[0]]

        result.prerequisites = alternatives[0] if alternatives else []
        result.prerequisiteAlternatives = alternatives

        result.prerequisiteExpression = {
            "type": "and",
            "operands": [
                {
                    "type": "or",
                    "operands": [{"type": "course", "courseCode": c} for c in group]
                }
                for group in or_groups
            ]
        }

    else:
        # Just AND courses
        result.prerequisites = and_courses
        result.prerequisiteExpression = {
            "type": "and",
            "operands": [{"type": "course", "courseCode": c} for c in and_courses]
        }

    return result


def parse_unit_requirement(text: str) -> Optional[Dict[str, Any]]:
    """Parse unit-based requirements like '48 units at 2000 level or higher'."""
    text_lower = text.lower()

    unit_match = re.search(r'(\d+)\s*units?', text_lower)
    if not unit_match:
        return None

    result = {
        "type": "unitLevel",
        "minUnits": int(unit_match.group(1)),
    }

    # Check for level requirement
    level_match = re.search(r'at\s+(?:the\s+)?(\d{4})\s*(?:level)?', text_lower)
    if level_match:
        result["level"] = int(level_match.group(1))

        if 'or higher' in text_lower or 'or above' in text_lower:
            result["levelOperator"] = "atLeast"
        elif 'or lower' in text_lower or 'or below' in text_lower:
            result["levelOperator"] = "atMost"
        else:
            result["levelOperator"] = "exact"

    # Check for course prefix
    prefix_match = re.search(r'(?:in|from)\s+([A-Z]{4})', text)
    if prefix_match:
        result["coursePrefix"] = prefix_match.group(1)

    return result


if __name__ == "__main__":
    # Test cases
    test_cases = [
        "MATH1013",
        "ENGN2218 and ENGN3338",
        "COMP1100 or COMP1730",
        "(MATH1013 or MATH1115) and PHYS1001",
        "24 units including ENGN2225",
        "Incompatible with MATH1115",
        "ENGN2218; Co-requisite: MATH2305",
    ]

    for test in test_cases:
        print(f"\nInput: {test}")
        result = parse_prerequisite_text(test)
        print(f"  Prerequisites: {result.prerequisites}")
        print(f"  Alternatives: {result.prerequisiteAlternatives}")
        print(f"  Corequisites: {result.corequisites}")
        print(f"  Incompatible: {result.incompatible}")
        print(f"  Expression: {result.prerequisiteExpression}")
