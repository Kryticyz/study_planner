#!/usr/bin/env python3
"""
ANU Programs and Courses Web Scraper

Scrapes course information from https://programsandcourses.anu.edu.au
and outputs structured data compatible with course planning systems.

Usage:
    python anu_course_scraper.py ENGN4339
    python anu_course_scraper.py ENGN4339 COMP1100 MATH1013 --year 2026
    python anu_course_scraper.py --file courses.txt --output courses.json
"""

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup


@dataclass
class Prerequisite:
    """
    Represents prerequisites with AND/OR logic.

    Structure:
    - Simple AND: ["MATH1013", "PHYS1001"] means MATH1013 AND PHYS1001
    - Simple OR: [["MATH1013", "MATH1115"]] means MATH1013 OR MATH1115
    - Complex: [["MATH1013", "MATH1115"], "PHYS1001"] means (MATH1013 OR MATH1115) AND PHYS1001

    Each element in the outer list is ANDed together.
    If an element is a list, courses within it are ORed.
    """

    courses: list = field(default_factory=list)  # Structured prerequisites
    raw_text: str = ""  # Original text for reference
    corequisites: list = field(
        default_factory=list
    )  # Courses that can be taken concurrently
    incompatible: list = field(
        default_factory=list
    )  # Courses that cannot be taken together
    minimum_units: Optional[int] = None  # e.g., "24 units of 2000-level courses"


@dataclass
class CourseOffering:
    """Represents when a course is offered."""

    year: int
    semester: str  # "S1", "S2", "Summer", "Winter", "X1" (non-standard)
    mode: str = "In Person"  # "In Person", "Online", "Hybrid"
    class_number: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


@dataclass
class Course:
    """Complete course information."""

    code: str
    name: str
    units: int
    level: int  # Derived from code: ENGN2228 -> 2000
    college: str
    subject: str  # e.g., "Engineering", "Computer Science"

    # Offerings
    semesters: list  # Simplified: ["S1", "S2"]
    offerings: list  # Detailed: list of CourseOffering

    # Requirements
    prerequisites: Optional[Prerequisite] = None
    assumed_knowledge: Optional[str] = None

    # Content
    description: str = ""
    learning_outcomes: list = field(default_factory=list)

    # Classification
    type: str = "elective"  # "core", "elective", "major-required"
    major_relevance: list = field(default_factory=list)
    areas_of_interest: list = field(default_factory=list)

    # Additional metadata
    convener: Optional[str] = None
    academic_career: str = "UGRD"  # "UGRD", "PGRD"
    mode_of_delivery: str = "In Person"  # "In Person", "Online", "Hybrid"
    offered_by: str = ""  # Offering unit
    graduate_attributes: list = field(default_factory=list)
    stem_course: bool = False
    url: str = ""

    # Assessment
    assessment: list = field(default_factory=list)
    workload: Optional[str] = None


class ANUCourseScraper:
    """Scraper for ANU Programs and Courses website."""

    BASE_URL = "https://programsandcourses.anu.edu.au"

    def __init__(self, year: int = 2026):
        self.year = year
        self.session = requests.Session()
        self.session.headers.update(
            {"User-Agent": "Mozilla/5.0 (compatible; ANUCourseScraper/1.0)"}
        )

    def get_course_url(self, code: str) -> str:
        """Generate URL for a course page."""
        return f"{self.BASE_URL}/{self.year}/course/{code}"

    def fetch_page(self, url: str) -> Optional[BeautifulSoup]:
        """Fetch and parse a page."""
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            return BeautifulSoup(response.text, "html.parser")
        except requests.RequestException as e:
            print(f"Error fetching {url}: {e}", file=sys.stderr)
            return None

    def parse_html(self, html_content: str) -> BeautifulSoup:
        """Parse HTML content directly (for testing or offline use)."""
        return BeautifulSoup(html_content, "html.parser")

    def scrape_from_html(self, html_content: str, code: str) -> Optional[Course]:
        """Scrape course from HTML content string."""
        soup = self.parse_html(html_content)
        return self._extract_course_from_soup(soup, code)

    def extract_course_code(self, soup: BeautifulSoup) -> str:
        """Extract course code from page."""
        code_elem = soup.find("dt", string="Code")
        if code_elem:
            dd = code_elem.find_next_sibling("dd")
            if dd and dd.find("a"):
                return dd.find("a").get_text(strip=True)
        # Fallback: extract from URL pattern in page
        link = soup.find("a", href=re.compile(r"/course/[A-Z]{4}\d{4}"))
        if link:
            match = re.search(r"([A-Z]{4}\d{4})", link.get("href", ""))
            if match:
                return match.group(1)
        return ""

    def extract_course_name(self, soup: BeautifulSoup) -> str:
        """Extract course name from page title."""
        h1 = soup.find("h1")
        if h1:
            return h1.get_text(strip=True)
        title = soup.find("title")
        if title:
            return title.get_text(strip=True).split(" - ")[0]
        return ""

    def extract_units(self, soup: BeautifulSoup) -> int:
        """Extract unit value."""
        unit_elem = soup.find("dt", string="Unit Value")
        if unit_elem:
            dd = unit_elem.find_next_sibling("dd")
            if dd:
                match = re.search(r"(\d+)\s*units?", dd.get_text())
                if match:
                    return int(match.group(1))
        return 6  # Default

    def extract_level(self, code: str) -> int:
        """Extract level from course code (e.g., ENGN2228 -> 2000)."""
        match = re.search(r"[A-Z]{4}(\d)", code)
        if match:
            return int(match.group(1)) * 1000
        return 0

    def extract_college(self, soup: BeautifulSoup) -> str:
        """Extract offering college."""
        college_elem = soup.find("dt", string="ANU College")
        if college_elem:
            dd = college_elem.find_next_sibling("dd")
            if dd:
                return dd.get_text(strip=True)
        return ""

    def extract_subject(self, soup: BeautifulSoup) -> str:
        """Extract course subject area."""
        subject_elem = soup.find("dt", string="Course subject")
        if subject_elem:
            dd = subject_elem.find_next_sibling("dd")
            if dd:
                return dd.get_text(strip=True)
        return ""

    def extract_semesters(self, soup: BeautifulSoup) -> list:
        """Extract simplified semester offerings."""
        semesters = []
        offered_elem = soup.find("dt", string="Offered in")
        if offered_elem:
            dd = offered_elem.find_next_sibling("dd")
            if dd:
                text = dd.get_text()
                if "First Semester" in text or "Semester 1" in text:
                    semesters.append("S1")
                if "Second Semester" in text or "Semester 2" in text:
                    semesters.append("S2")
                if "Summer" in text:
                    semesters.append("Summer")
                if "Winter" in text:
                    semesters.append("Winter")
        return semesters if semesters else ["Unknown"]

    def extract_offerings(self, soup: BeautifulSoup) -> list:
        """Extract detailed offering information from tables."""
        offerings = []

        # Find offering tables
        tables = soup.find_all("table")
        for table in tables:
            headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
            if "class number" not in headers and "class start date" not in headers:
                continue

            for row in table.find_all("tr")[1:]:  # Skip header
                cells = row.find_all("td")
                if len(cells) >= 5:
                    # Determine semester from section heading
                    section = row.find_previous(["h3", "h4"])
                    semester = "Unknown"
                    if section:
                        text = section.get_text()
                        if "First" in text or "Semester 1" in text:
                            semester = "S1"
                        elif "Second" in text or "Semester 2" in text:
                            semester = "S2"
                        elif "Summer" in text:
                            semester = "Summer"
                        elif "Winter" in text:
                            semester = "Winter"

                    offering = CourseOffering(
                        year=self.year,
                        semester=semester,
                        class_number=cells[0].get_text(strip=True)
                        if len(cells) > 0
                        else None,
                        start_date=cells[1].get_text(strip=True)
                        if len(cells) > 1
                        else None,
                        end_date=cells[4].get_text(strip=True)
                        if len(cells) > 4
                        else None,
                        mode=cells[5].get_text(strip=True)
                        if len(cells) > 5
                        else "In Person",
                    )
                    offerings.append(offering)

        return offerings

    def parse_prerequisites(self, text: str) -> Prerequisite:
        """
        Parse prerequisite text into structured format.

        Handles patterns like:
        - "MATH1013 and PHYS1001" -> AND
        - "MATH1013 or MATH1115" -> OR
        - "(MATH1013 or MATH1115) and PHYS1001" -> Complex
        - "24 units" -> minimum units requirement
        """
        prereq = Prerequisite(raw_text=text)

        # Extract course codes
        course_pattern = r"[A-Z]{4}\d{4}"
        all_courses = re.findall(course_pattern, text)

        if not all_courses:
            return prereq

        # Check for unit requirements
        unit_match = re.search(r"(\d+)\s*units?", text.lower())
        if unit_match:
            prereq.minimum_units = int(unit_match.group(1))

        # Normalize text for parsing
        normalized = text.lower()

        # Try to parse logical structure
        # Look for "or" groups first
        or_groups = []
        and_courses = []

        # Split by " and " to find main AND components
        and_parts = re.split(r"\s+and\s+", text, flags=re.IGNORECASE)

        for part in and_parts:
            part_courses = re.findall(course_pattern, part)
            if not part_courses:
                continue

            # Check if this part contains "or"
            if re.search(r"\s+or\s+", part, re.IGNORECASE):
                # This is an OR group
                or_groups.append(part_courses)
            else:
                # Single course(s) in AND relationship
                and_courses.extend(part_courses)

        # Build the structured prerequisites
        result = []
        for course in and_courses:
            result.append(course)
        for group in or_groups:
            if len(group) > 1:
                result.append(group)  # OR group
            else:
                result.append(group[0])  # Single course

        prereq.courses = result if result else all_courses
        return prereq

    def extract_prerequisites(self, soup: BeautifulSoup) -> Optional[Prerequisite]:
        """Extract prerequisite information."""
        # Find the requisite section
        req_section = soup.find("h2", string=re.compile(r"Requisite", re.IGNORECASE))
        if not req_section:
            req_section = soup.find("h2", id="incompatibility")

        if req_section:
            # Get all text until next section
            text_parts = []
            for sibling in req_section.find_next_siblings():
                if sibling.name in ["h2", "h1"]:
                    break
                if sibling.name == "p" or sibling.get_text(strip=True):
                    text_parts.append(sibling.get_text(strip=True))

            full_text = " ".join(text_parts)
            if full_text:
                prereq = self.parse_prerequisites(full_text)

                # Check for incompatibility
                if "incompatible" in full_text.lower():
                    incompat_match = re.findall(
                        r"incompatible with ([A-Z]{4}\d{4})", full_text, re.IGNORECASE
                    )
                    prereq.incompatible = incompat_match

                return prereq

        return None

    def extract_description(self, soup: BeautifulSoup) -> str:
        """Extract course description/introduction."""
        # Look for introduction section
        intro_section = soup.find(
            "h2", string=re.compile(r"Introduction", re.IGNORECASE)
        )
        if intro_section:
            p = intro_section.find_next("p")
            if p:
                return p.get_text(strip=True)

        # Fallback: look for first substantial paragraph after course info
        main_content = soup.find("div", class_="body__inner")
        if main_content:
            for p in main_content.find_all("p"):
                text = p.get_text(strip=True)
                if len(text) > 100:  # Substantial paragraph
                    return text

        return ""

    def extract_learning_outcomes(self, soup: BeautifulSoup) -> list:
        """Extract learning outcomes."""
        outcomes = []
        lo_section = soup.find(
            "h2", string=re.compile(r"Learning Outcomes", re.IGNORECASE)
        )
        if lo_section:
            ol = lo_section.find_next("ol")
            if ol:
                for li in ol.find_all("li"):
                    outcomes.append(li.get_text(strip=True))
        return outcomes

    def extract_assessment(self, soup: BeautifulSoup) -> list:
        """Extract assessment items."""
        assessment = []
        assess_section = soup.find(
            "h2", string=re.compile(r"Assessment", re.IGNORECASE)
        )
        if assess_section:
            ol = assess_section.find_next("ol")
            if ol:
                for li in ol.find_all("li"):
                    text = li.get_text(strip=True)
                    # Try to extract weight
                    weight_match = re.search(r"\((\d+)\)", text)
                    assessment.append(
                        {
                            "description": re.sub(r"\s*\(\d+\)\s*", " ", text).strip(),
                            "weight": int(weight_match.group(1))
                            if weight_match
                            else None,
                        }
                    )
        return assessment

    def extract_convener(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract course convener."""
        convener_elem = soup.find(
            "dt", string=re.compile(r"Course convener", re.IGNORECASE)
        )
        if convener_elem:
            dd = convener_elem.find_next_sibling("dd")
            if dd:
                return dd.get_text(strip=True)
        return None

    def extract_areas_of_interest(self, soup: BeautifulSoup) -> list:
        """Extract areas of interest."""
        areas_elem = soup.find(
            "dt", string=re.compile(r"Areas of interest", re.IGNORECASE)
        )
        if areas_elem:
            dd = areas_elem.find_next_sibling("dd")
            if dd:
                return [a.strip() for a in dd.get_text().split(",")]
        return []

    def extract_assumed_knowledge(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract assumed knowledge."""
        ak_section = soup.find(
            "h2", string=re.compile(r"Assumed Knowledge", re.IGNORECASE)
        )
        if ak_section:
            p = ak_section.find_next("p")
            if p:
                return p.get_text(strip=True)
        return None

    def extract_workload(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract workload information."""
        workload_section = soup.find(
            "h2", string=re.compile(r"Workload", re.IGNORECASE)
        )
        if workload_section:
            p = workload_section.find_next("p")
            if p:
                return p.get_text(strip=True)
        return None

    def is_stem(self, soup: BeautifulSoup) -> bool:
        """Check if course is marked as STEM."""
        return soup.find(string=re.compile(r"STEM Course", re.IGNORECASE)) is not None

    def extract_mode_of_delivery(self, soup: BeautifulSoup) -> str:
        """Extract mode of delivery (In Person, Online, etc.)."""
        mode_elem = soup.find(
            "dt", string=re.compile(r"Mode of delivery", re.IGNORECASE)
        )
        if mode_elem:
            dd = mode_elem.find_next_sibling("dd")
            if dd:
                return dd.get_text(strip=True)
        return "In Person"  # Default

    def extract_academic_career(self, soup: BeautifulSoup) -> str:
        """Extract academic career (UGRD, PGRD)."""
        career_elem = soup.find(
            "dt", string=re.compile(r"Academic career", re.IGNORECASE)
        )
        if career_elem:
            dd = career_elem.find_next_sibling("dd")
            if dd:
                return dd.get_text(strip=True)
        return "UGRD"  # Default

    def extract_graduate_attributes(self, soup: BeautifulSoup) -> list:
        """Extract graduate attributes."""
        attr_elem = soup.find(
            "dt", string=re.compile(r"Graduate Attributes", re.IGNORECASE)
        )
        if attr_elem:
            dd = attr_elem.find_next_sibling("dd")
            if dd:
                # May be comma-separated or in a list
                text = dd.get_text(strip=True)
                return [a.strip() for a in text.split(",") if a.strip()]
        return []

    def extract_offered_by(self, soup: BeautifulSoup) -> str:
        """Extract the offering unit (may differ from ANU College)."""
        offered_elem = soup.find("dt", string=re.compile(r"Offered by", re.IGNORECASE))
        if offered_elem:
            dd = offered_elem.find_next_sibling("dd")
            if dd:
                return dd.get_text(strip=True)
        return ""

    def _extract_course_from_soup(
        self, soup: BeautifulSoup, code: str
    ) -> Optional[Course]:
        """Extract course information from parsed HTML."""
        course_code = self.extract_course_code(soup) or code
        url = self.get_course_url(code)

        course = Course(
            code=course_code,
            name=self.extract_course_name(soup),
            units=self.extract_units(soup),
            level=self.extract_level(course_code),
            college=self.extract_college(soup),
            subject=self.extract_subject(soup),
            semesters=self.extract_semesters(soup),
            offerings=[asdict(o) for o in self.extract_offerings(soup)],
            prerequisites=self.extract_prerequisites(soup),
            assumed_knowledge=self.extract_assumed_knowledge(soup),
            description=self.extract_description(soup),
            learning_outcomes=self.extract_learning_outcomes(soup),
            assessment=self.extract_assessment(soup),
            convener=self.extract_convener(soup),
            academic_career=self.extract_academic_career(soup),
            mode_of_delivery=self.extract_mode_of_delivery(soup),
            offered_by=self.extract_offered_by(soup),
            graduate_attributes=self.extract_graduate_attributes(soup),
            areas_of_interest=self.extract_areas_of_interest(soup),
            workload=self.extract_workload(soup),
            stem_course=self.is_stem(soup),
            url=url,
        )

        return course

    def scrape_course(self, code: str) -> Optional[Course]:
        """Scrape a single course page."""
        url = self.get_course_url(code)
        soup = self.fetch_page(url)

        if not soup:
            return None

        return self._extract_course_from_soup(soup, code)


def course_to_dict(course: Course) -> dict:
    """Convert Course to dictionary, handling nested dataclasses."""
    result = asdict(course)
    # Convert Prerequisite if present
    if course.prerequisites:
        result["prerequisites"] = asdict(course.prerequisites)
    return result


def course_to_simple_format(course: Course) -> dict:
    """
    Convert to the simplified format requested by user.

    Example output:
    {
        "code": "ENGN4339",
        "name": "Aerospace Instrumentation and Avionics",
        "units": 6,
        "level": 4000,
        "college": "Engineering",
        "semesters": ["S2"],
        "prerequisites": {
            "requires": [["ENGN2218", "ENGN3338"]],  # AND relationship
            "raw": "To enrol in this course you must have completed ENGN2218..."
        },
        "description": "...",
        "type": "elective",
        "majorRelevance": []
    }
    """
    prereqs = None
    if course.prerequisites:
        prereqs = {
            "requires": course.prerequisites.courses,
            "raw": course.prerequisites.raw_text,
        }
        if course.prerequisites.corequisites:
            prereqs["corequisites"] = course.prerequisites.corequisites
        if course.prerequisites.incompatible:
            prereqs["incompatible"] = course.prerequisites.incompatible
        if course.prerequisites.minimum_units:
            prereqs["minimumUnits"] = course.prerequisites.minimum_units

    return {
        "code": course.code,
        "name": course.name,
        "units": course.units,
        "level": course.level,
        "college": course.subject or course.college.replace("ANU College of ", ""),
        "semesters": course.semesters,
        "prerequisites": prereqs,
        "description": course.description[:200] + "..."
        if len(course.description) > 200
        else course.description,
        "type": course.type,
        "majorRelevance": course.major_relevance,
        # Sidebar fields
        "convener": course.convener,
        "academicCareer": course.academic_career,
        "modeOfDelivery": course.mode_of_delivery,
        "offeredBy": course.offered_by,
        "areasOfInterest": course.areas_of_interest,
        "graduateAttributes": course.graduate_attributes,
        "assumedKnowledge": course.assumed_knowledge,
        "stemCourse": course.stem_course,
    }


def main():
    parser = argparse.ArgumentParser(description="Scrape ANU course information")
    parser.add_argument(
        "courses", nargs="*", help="Course codes to scrape (e.g., ENGN4339)"
    )
    parser.add_argument(
        "--year", type=int, default=2026, help="Academic year (default: 2026)"
    )
    parser.add_argument(
        "--file", "-f", help="File containing course codes (one per line)"
    )
    parser.add_argument("--output", "-o", help="Output JSON file")
    parser.add_argument(
        "--format",
        choices=["full", "simple"],
        default="simple",
        help="Output format (default: simple)",
    )

    args = parser.parse_args()

    # Collect course codes
    codes = list(args.courses)
    if args.file:
        with open(args.file) as f:
            codes.extend(line.strip() for line in f if line.strip())

    if not codes:
        parser.print_help()
        print("\nError: No course codes provided", file=sys.stderr)
        sys.exit(1)

    # Scrape courses
    scraper = ANUCourseScraper(year=args.year)
    results = {}

    for code in codes:
        print(f"Scraping {code}...", file=sys.stderr)
        course = scraper.scrape_course(code.upper())
        if course:
            if args.format == "full":
                results[code] = course_to_dict(course)
            else:
                results[code] = course_to_simple_format(course)
        else:
            print(f"  Failed to scrape {code}", file=sys.stderr)

    # Output
    output = json.dumps(results, indent=2, default=str)
    if args.output:
        with open(args.output, "w") as f:
            f.write(output)
        print(f"Output written to {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
