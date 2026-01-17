#!/usr/bin/env python3
"""
ANU Program/Degree Requirements Scraper

Scrapes degree program information from https://programsandcourses.anu.edu.au
and outputs structured data for course planning systems.

Usage:
    python anu_program_scraper.py aengi
    python anu_program_scraper.py aengi --year 2026 --output program.json
"""

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from typing import List, Optional, Union
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup


@dataclass
class CourseChoice:
    """A single course option within a requirement."""

    code: str
    name: str
    units: int = 6
    url: str = ""


@dataclass
class RequirementGroup:
    """
    A group of requirements (e.g., "6 units from completion of a course from the following list").

    Types:
    - "compulsory": All listed courses must be completed
    - "choose": Select courses from list to meet unit requirement
    - "major": Complete one of the listed majors
    - "subject_area": Complete courses from specified subject areas
    - "elective": Free elective units
    """

    type: str  # "compulsory", "choose", "major", "subject_area", "elective"
    units: int  # Total units required from this group
    description: str  # Original description text
    courses: List[CourseChoice] = field(default_factory=list)  # Available courses
    majors: List[str] = field(default_factory=list)  # For major requirements
    subject_areas: List[str] = field(
        default_factory=list
    )  # For subject area requirements
    note: str = ""  # Additional notes (e.g., "of which 12 units contribute towards...")


@dataclass
class Major:
    """A major available within the program."""

    code: str
    name: str
    url: str = ""


@dataclass
class StudyPlanCourse:
    """A course in a study plan."""

    code: str
    name: str
    units: int = 6
    is_placeholder: bool = False  # True for "Elective Course", "Major Course", etc.


@dataclass
class StudyPlanSemester:
    """A semester in a study plan."""

    year: int
    semester: int  # 1 or 2
    courses: List[StudyPlanCourse] = field(default_factory=list)


@dataclass
class HonoursInfo:
    """Honours calculation information."""

    enrolment_course: str = ""  # e.g., "ENGN4100"
    calculation_method: str = ""  # Description of WAM calculation
    weightings: dict = field(default_factory=dict)  # Category -> weight mapping


@dataclass
class Program:
    """Complete program/degree information."""

    # Basic info
    code: str  # e.g., "AENGI"
    name: str  # e.g., "Bachelor of Engineering (Honours)"
    post_nominal: str  # e.g., "BEngHons"

    # Duration and units
    duration: str  # e.g., "4 year full-time"
    total_units: int  # e.g., 192
    max_1000_level_units: int = 60  # Maximum 1000-level units allowed

    # Admission
    atar: Optional[int] = None
    ib_score: Optional[int] = None
    prerequisites: dict = field(default_factory=dict)  # State -> requirement

    # Classification
    degree_type: str = "single"  # "single", "double", "honours"
    field_of_education: str = ""
    stem_program: bool = False
    college: str = ""

    # Academic codes
    cricos_code: str = ""
    uac_code: str = ""

    # Requirements
    requirements: List[RequirementGroup] = field(default_factory=list)

    # Majors
    available_majors: List[Major] = field(default_factory=list)

    # Study plans
    study_plans: List[StudyPlanSemester] = field(default_factory=list)

    # Honours
    honours_info: Optional[HonoursInfo] = None

    # Content
    description: str = ""
    learning_outcomes: List[str] = field(default_factory=list)
    career_options: str = ""

    # Metadata
    academic_contact: str = ""
    mode_of_delivery: str = "In Person"
    url: str = ""


class ANUProgramScraper:
    """Scraper for ANU Programs and Courses website - Program pages."""

    BASE_URL = "https://programsandcourses.anu.edu.au"

    def __init__(self, year: int = 2026):
        self.year = year
        self.session = requests.Session()
        self.session.headers.update(
            {"User-Agent": "Mozilla/5.0 (compatible; ANUProgramScraper/1.0)"}
        )

    def get_program_url(self, code: str) -> str:
        """Generate URL for a program page."""
        return f"{self.BASE_URL}/{self.year}/program/{code}"

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
        """Parse HTML content directly."""
        return BeautifulSoup(html_content, "html.parser")

    def scrape_from_html(self, html_content: str, code: str) -> Optional[Program]:
        """Scrape program from HTML content string."""
        soup = self.parse_html(html_content)
        return self._extract_program_from_soup(soup, code)

    # === Basic Info Extraction ===

    def extract_program_name(self, soup: BeautifulSoup) -> str:
        """Extract program name."""
        h1 = soup.find("h1")
        if h1:
            return h1.get_text(strip=True)
        return ""

    def extract_post_nominal(self, soup: BeautifulSoup) -> str:
        """Extract post nominal (e.g., BEngHons)."""
        elem = soup.find("dt", string=re.compile(r"Post Nominal", re.IGNORECASE))
        if elem:
            dd = elem.find_next_sibling("dd")
            if dd:
                return dd.get_text(strip=True)
        return ""

    def extract_duration(self, soup: BeautifulSoup) -> str:
        """Extract program duration."""
        elem = soup.find("dt", string=re.compile(r"Length", re.IGNORECASE))
        if elem:
            dd = elem.find_next_sibling("dd")
            if dd:
                return dd.get_text(strip=True)
        return ""

    def extract_total_units(self, soup: BeautifulSoup) -> int:
        """Extract minimum units required."""
        elem = soup.find("dt", string=re.compile(r"Minimum", re.IGNORECASE))
        if elem:
            dd = elem.find_next_sibling("dd")
            if dd:
                match = re.search(r"(\d+)\s*[Uu]nits?", dd.get_text())
                if match:
                    return int(match.group(1))
        # Try from requirements section
        req_section = soup.find("h2", id="program-requirements")
        if req_section:
            text = req_section.find_next("p")
            if text:
                match = re.search(r"completion of (\d+) units", text.get_text())
                if match:
                    return int(match.group(1))
        return 0

    # === Admission Info ===

    def extract_atar(self, soup: BeautifulSoup) -> Optional[int]:
        """Extract ATAR requirement."""
        elem = soup.find("dt", string=re.compile(r"ATAR", re.IGNORECASE))
        if elem:
            dd = elem.find_next_sibling("dd")
            if dd:
                # Look for link with ATAR value
                link = dd.find("a")
                if link:
                    match = re.search(r"(\d+)", link.get_text())
                    if match:
                        return int(match.group(1))
        # Alternative: look in admission requirements section
        atar_text = soup.find(string=re.compile(r"ATAR:\s*\d+"))
        if atar_text:
            match = re.search(r"ATAR:\s*(\d+)", atar_text)
            if match:
                return int(match.group(1))
        return None

    def extract_ib_score(self, soup: BeautifulSoup) -> Optional[int]:
        """Extract IB score requirement."""
        elem = soup.find("dt", string=re.compile(r"IB", re.IGNORECASE))
        if elem:
            dd = elem.find_next_sibling("dd")
            if dd:
                match = re.search(r"(\d+)", dd.get_text())
                if match:
                    return int(match.group(1))
        return None

    def extract_prerequisites(self, soup: BeautifulSoup) -> dict:
        """Extract state-based prerequisites."""
        prereqs = {}
        prereq_section = soup.find("h2", id="prerequisites")
        if prereq_section:
            # Look for state: requirement patterns
            for p in prereq_section.find_next_siblings(["p", "div"]):
                if p.name == "h2":
                    break
                text = p.get_text(strip=True)
                # Match patterns like "ACT: Mathematical Methods..."
                match = re.match(
                    r"^([A-Z]{2,3}(?:\s*/\s*[A-Z]{2,3})?)\s*:\s*(.+)$", text
                )
                if match:
                    states = match.group(1).replace(" ", "").split("/")
                    requirement = match.group(2)
                    for state in states:
                        prereqs[state] = requirement
                # Match "IB: ..." pattern
                ib_match = re.match(r"^IB\s*:\s*(.+)$", text)
                if ib_match:
                    prereqs["IB"] = ib_match.group(1)
        return prereqs

    # === Program Codes ===

    def extract_cricos_code(self, soup: BeautifulSoup) -> str:
        """Extract CRICOS code."""
        elem = soup.find("dt", string=re.compile(r"CRICOS", re.IGNORECASE))
        if elem:
            dd = elem.find_next_sibling("dd")
            if dd:
                return dd.get_text(strip=True)
        return ""

    def extract_uac_code(self, soup: BeautifulSoup) -> str:
        """Extract UAC code."""
        elem = soup.find("dt", string=re.compile(r"UAC", re.IGNORECASE))
        if elem:
            dd = elem.find_next_sibling("dd")
            if dd:
                link = dd.find("a")
                if link:
                    match = re.search(r"(\d+)", link.get_text())
                    if match:
                        return match.group(1)
        return ""

    # === Classification ===

    def extract_college(self, soup: BeautifulSoup) -> str:
        """Extract offering college."""
        # Look in subtitle or academic contact
        subtitle = soup.find("p", class_="intro")
        if subtitle:
            text = subtitle.get_text()
            match = re.search(r"offered by the (ANU College of [^.]+)", text)
            if match:
                return match.group(1)
        return ""

    def extract_field_of_education(self, soup: BeautifulSoup) -> str:
        """Extract field of education."""
        elem = soup.find("dt", string=re.compile(r"Field of Education", re.IGNORECASE))
        if elem:
            dd = elem.find_next_sibling("dd")
            if dd:
                return dd.get_text(strip=True)
        return ""

    def is_stem_program(self, soup: BeautifulSoup) -> bool:
        """Check if program is STEM."""
        return soup.find(string=re.compile(r"STEM Program", re.IGNORECASE)) is not None

    def extract_mode_of_delivery(self, soup: BeautifulSoup) -> str:
        """Extract mode of delivery."""
        elem = soup.find("dt", string=re.compile(r"Mode of delivery", re.IGNORECASE))
        if elem:
            dd = elem.find_next_sibling("dd")
            if dd:
                return dd.get_text(strip=True)
        return "In Person"

    def extract_academic_contact(self, soup: BeautifulSoup) -> str:
        """Extract academic contact."""
        elem = soup.find("dt", string=re.compile(r"Academic contact", re.IGNORECASE))
        if elem:
            dd = elem.find_next_sibling("dd")
            if dd:
                return dd.get_text(strip=True)
        return ""

    # === Requirements Extraction ===

    def extract_requirements(self, soup: BeautifulSoup) -> List[RequirementGroup]:
        """Extract program requirements."""
        requirements = []

        req_section = soup.find("h2", id="program-requirements")
        if not req_section:
            req_section = soup.find(
                "h2", string=re.compile(r"Program Requirements", re.IGNORECASE)
            )

        if not req_section:
            return requirements

        # Get all content until next major section
        current = req_section.find_next_sibling()
        current_text = ""

        while current and current.name != "h2":
            if current.name == "p":
                text = current.get_text(strip=True)

                # Check for unit requirements pattern
                unit_match = re.search(
                    r"(\d+)\s*units?\s+(?:from\s+)?(?:completion\s+of\s+)?(.+)",
                    text,
                    re.IGNORECASE,
                )

                if unit_match:
                    units = int(unit_match.group(1))
                    description = unit_match.group(2)

                    # Determine requirement type
                    req_type = self._determine_requirement_type(text, description)

                    req = RequirementGroup(type=req_type, units=units, description=text)

                    # Look for following course list or links
                    next_elem = current.find_next_sibling()
                    while next_elem and next_elem.name not in ["p", "h2", "h3"]:
                        if next_elem.name == "a" or next_elem.find("a"):
                            links = (
                                next_elem.find_all("a")
                                if next_elem.name != "a"
                                else [next_elem]
                            )
                            for link in links:
                                href = link.get("href", "")
                                if "/course/" in href:
                                    code_match = re.search(
                                        r"/course/([A-Z]{4}\d{4})", href
                                    )
                                    if code_match:
                                        course = CourseChoice(
                                            code=code_match.group(1),
                                            name=link.get_text(strip=True),
                                            url=self.BASE_URL + href
                                            if href.startswith("/")
                                            else href,
                                        )
                                        req.courses.append(course)
                        next_elem = next_elem.find_next_sibling()

                    # Extract subject areas if applicable
                    if req_type == "subject_area":
                        area_match = re.search(
                            r"subject areas?:\s*([A-Z]{4})", text, re.IGNORECASE
                        )
                        if area_match:
                            req.subject_areas.append(area_match.group(1))
                        else:
                            # Try to find ENGN or other codes
                            codes = re.findall(r"\b([A-Z]{4})\s+[A-Z][a-z]+", text)
                            req.subject_areas.extend(codes)

                    requirements.append(req)

                # Check for max 1000-level constraint
                max_match = re.search(
                    r"maximum of (\d+) units.*1000-level", text, re.IGNORECASE
                )
                if max_match:
                    # Store this as metadata, not a requirement
                    pass

            # Handle course links directly following requirement text
            elif current.name == "a":
                href = current.get("href", "")
                if "/course/" in href and requirements:
                    code_match = re.search(r"/course/([A-Z]{4}\d{4})", href)
                    if code_match:
                        course = CourseChoice(
                            code=code_match.group(1),
                            name=current.get_text(strip=True),
                            url=self.BASE_URL + href if href.startswith("/") else href,
                        )
                        requirements[-1].courses.append(course)

            current = current.find_next_sibling()

        # Post-process: extract courses from links within requirement descriptions
        self._extract_courses_from_requirements(soup, requirements)

        return requirements

    def _determine_requirement_type(self, full_text: str, description: str) -> str:
        """Determine the type of requirement based on text."""
        lower_text = full_text.lower()

        if "compulsory" in lower_text or "following courses" in lower_text:
            return "compulsory"
        elif "major" in lower_text:
            return "major"
        elif "subject area" in lower_text or "ENGN Engineering" in full_text:
            return "subject_area"
        elif "elective" in lower_text:
            return "elective"
        elif "from completion of a course from the following list" in lower_text:
            return "choose"
        elif "from completion of one of" in lower_text:
            return "major"
        else:
            return "choose"

    def _extract_courses_from_requirements(
        self, soup: BeautifulSoup, requirements: List[RequirementGroup]
    ):
        """Extract course codes from requirement sections."""
        req_section = soup.find("h2", id="program-requirements")
        if not req_section:
            return

        # Find all course links in the requirements section
        all_links = []
        current = req_section.find_next_sibling()
        while current and current.name != "h2":
            links = current.find_all("a", href=re.compile(r"/course/[A-Z]{4}\d{4}"))
            all_links.extend(links)
            current = current.find_next_sibling()

        # Group links by their position relative to requirement descriptions
        for link in all_links:
            href = link.get("href", "")
            code_match = re.search(r"/course/([A-Z]{4}\d{4})", href)
            if code_match:
                code = code_match.group(1)
                name = link.get_text(strip=True)

                # Find which requirement this belongs to
                # Look for preceding p tag with unit description
                prev = link.find_previous("p")
                if prev:
                    prev_text = prev.get_text()
                    for req in requirements:
                        if req.description in prev_text or prev_text in req.description:
                            # Check if course already added
                            if not any(c.code == code for c in req.courses):
                                req.courses.append(
                                    CourseChoice(
                                        code=code, name=name, url=self.BASE_URL + href
                                    )
                                )
                            break

    # === Majors Extraction ===

    def extract_majors(self, soup: BeautifulSoup) -> List[Major]:
        """Extract available majors."""
        majors = []

        major_section = soup.find("h2", id="majors")
        if not major_section:
            major_section = soup.find(
                "h2", string=re.compile(r"^Majors$", re.IGNORECASE)
            )

        if major_section:
            # Find all major links
            current = major_section.find_next_sibling()
            while current and current.name != "h2":
                links = current.find_all("a", href=re.compile(r"/major/"))
                for link in links:
                    href = link.get("href", "")
                    code_match = re.search(r"/major/([A-Z]+-[A-Z]+)", href)
                    if code_match:
                        major = Major(
                            code=code_match.group(1),
                            name=link.get_text(strip=True),
                            url=self.BASE_URL + href if href.startswith("/") else href,
                        )
                        if not any(m.code == major.code for m in majors):
                            majors.append(major)
                current = current.find_next_sibling()

        return majors

    # === Study Plan Extraction ===

    def extract_study_plans(self, soup: BeautifulSoup) -> List[StudyPlanSemester]:
        """Extract study plan/sample structure."""
        semesters = []

        # Find study options tables
        tables = soup.find_all("table")

        for table in tables:
            # Check if this is a study plan table
            first_cell = table.find("td")
            if first_cell and re.search(r"Year \d+", first_cell.get_text()):
                rows = table.find_all("tr")
                current_year = 0
                sem_in_year = 1

                for row in rows:
                    cells = row.find_all("td")
                    if not cells:
                        continue

                    # Check for year indicator
                    first_text = cells[0].get_text(strip=True)
                    year_match = re.search(r"Year (\d+)", first_text)
                    if year_match:
                        current_year = int(year_match.group(1))
                        sem_in_year = 1

                    if current_year == 0:
                        continue

                    # Extract courses from this row
                    semester = StudyPlanSemester(
                        year=current_year, semester=sem_in_year
                    )

                    for cell in cells[1:] if year_match else cells:
                        cell_text = cell.get_text(strip=True)
                        if not cell_text:
                            continue

                        # Check for course link
                        link = cell.find("a", href=re.compile(r"/course/"))
                        if link:
                            href = link.get("href", "")
                            code_match = re.search(r"/course/([A-Z]{4}\d{4})", href)
                            if code_match:
                                # Extract units from cell text
                                units_match = re.search(
                                    r"(\d+)\s*units?", cell_text, re.IGNORECASE
                                )
                                units = int(units_match.group(1)) if units_match else 6

                                course = StudyPlanCourse(
                                    code=code_match.group(1),
                                    name=link.get_text(strip=True),
                                    units=units,
                                    is_placeholder=False,
                                )
                                semester.courses.append(course)
                        else:
                            # Placeholder like "Elective Course" or "Major Course"
                            if re.search(
                                r"(elective|major|course)", cell_text, re.IGNORECASE
                            ):
                                units_match = re.search(
                                    r"(\d+)\s*units?", cell_text, re.IGNORECASE
                                )
                                units = int(units_match.group(1)) if units_match else 6

                                course = StudyPlanCourse(
                                    code="",
                                    name=cell_text,
                                    units=units,
                                    is_placeholder=True,
                                )
                                semester.courses.append(course)

                    if semester.courses:
                        semesters.append(semester)
                        sem_in_year = 2 if sem_in_year == 1 else 1

        return semesters

    # === Honours Info ===

    def extract_honours_info(self, soup: BeautifulSoup) -> Optional[HonoursInfo]:
        """Extract honours calculation information."""
        honours = HonoursInfo()

        # Look for honours section
        honours_heading = soup.find(string=re.compile(r"Honours", re.IGNORECASE))
        if not honours_heading:
            return None

        # Find enrolment course
        engn4100_link = soup.find("a", href=re.compile(r"/course/ENGN4100"))
        if engn4100_link:
            honours.enrolment_course = "ENGN4100"

        # Extract weightings
        weighting_patterns = [
            (
                r"Science and Engineering Foundations.*?\((\d+\.?\d*)\s*weighting\)",
                "foundations",
            ),
            (r"Engineering Fundamentals.*?\((\d+\.?\d*)\s*weighting\)", "fundamentals"),
            (r"Professional Core.*?\((\d+\.?\d*)\s*weighting\)", "professional_core"),
            (r"Engineering Discipline.*?\((\d+\.?\d*)\s*weighting\)", "discipline"),
        ]

        page_text = soup.get_text()
        for pattern, key in weighting_patterns:
            match = re.search(pattern, page_text, re.IGNORECASE)
            if match:
                honours.weightings[key] = float(match.group(1))

        if honours.enrolment_course or honours.weightings:
            return honours
        return None

    # === Content ===

    def extract_description(self, soup: BeautifulSoup) -> str:
        """Extract program description."""
        intro_section = soup.find("h2", id="introduction")
        if intro_section:
            p = intro_section.find_next("p")
            if p:
                return p.get_text(strip=True)
        return ""

    def extract_learning_outcomes(self, soup: BeautifulSoup) -> List[str]:
        """Extract learning outcomes."""
        outcomes = []
        lo_section = soup.find("h2", id="learning-outcomes")
        if not lo_section:
            lo_section = soup.find(
                "h2", string=re.compile(r"Learning Outcomes", re.IGNORECASE)
            )

        if lo_section:
            ol = lo_section.find_next("ol")
            if ol:
                for li in ol.find_all("li"):
                    outcomes.append(li.get_text(strip=True))
        return outcomes

    def extract_career_options(self, soup: BeautifulSoup) -> str:
        """Extract career options text."""
        career_section = soup.find("h2", id="career-options")
        if career_section:
            p = career_section.find_next("p")
            if p:
                return p.get_text(strip=True)
        return ""

    # === Main Extraction ===

    def _extract_program_from_soup(
        self, soup: BeautifulSoup, code: str
    ) -> Optional[Program]:
        """Extract program information from parsed HTML."""
        url = self.get_program_url(code)

        program = Program(
            code=code.upper(),
            name=self.extract_program_name(soup),
            post_nominal=self.extract_post_nominal(soup),
            duration=self.extract_duration(soup),
            total_units=self.extract_total_units(soup),
            atar=self.extract_atar(soup),
            ib_score=self.extract_ib_score(soup),
            prerequisites=self.extract_prerequisites(soup),
            college=self.extract_college(soup),
            field_of_education=self.extract_field_of_education(soup),
            stem_program=self.is_stem_program(soup),
            cricos_code=self.extract_cricos_code(soup),
            uac_code=self.extract_uac_code(soup),
            mode_of_delivery=self.extract_mode_of_delivery(soup),
            academic_contact=self.extract_academic_contact(soup),
            requirements=self.extract_requirements(soup),
            available_majors=self.extract_majors(soup),
            study_plans=self.extract_study_plans(soup),
            honours_info=self.extract_honours_info(soup),
            description=self.extract_description(soup),
            learning_outcomes=self.extract_learning_outcomes(soup),
            career_options=self.extract_career_options(soup),
            url=url,
        )

        return program

    def scrape_program(self, code: str) -> Optional[Program]:
        """Scrape a single program page."""
        url = self.get_program_url(code)
        soup = self.fetch_page(url)

        if not soup:
            return None

        return self._extract_program_from_soup(soup, code)


def program_to_dict(program: Program) -> dict:
    """Convert Program to dictionary with proper nested handling."""
    result = {
        "code": program.code,
        "name": program.name,
        "postNominal": program.post_nominal,
        "duration": program.duration,
        "totalUnits": program.total_units,
        "max1000LevelUnits": program.max_1000_level_units,
        "admission": {
            "atar": program.atar,
            "ibScore": program.ib_score,
            "prerequisites": program.prerequisites,
        },
        "classification": {
            "degreeType": program.degree_type,
            "fieldOfEducation": program.field_of_education,
            "stemProgram": program.stem_program,
            "college": program.college,
        },
        "codes": {"cricosCode": program.cricos_code, "uacCode": program.uac_code},
        "requirements": [
            {
                "type": req.type,
                "units": req.units,
                "description": req.description,
                "courses": [asdict(c) for c in req.courses],
                "majors": req.majors,
                "subjectAreas": req.subject_areas,
                "note": req.note,
            }
            for req in program.requirements
        ],
        "availableMajors": [asdict(m) for m in program.available_majors],
        "studyPlans": [
            {
                "year": sem.year,
                "semester": sem.semester,
                "courses": [asdict(c) for c in sem.courses],
            }
            for sem in program.study_plans
        ],
        "honoursInfo": asdict(program.honours_info) if program.honours_info else None,
        "description": program.description,
        "learningOutcomes": program.learning_outcomes,
        "careerOptions": program.career_options,
        "academicContact": program.academic_contact,
        "modeOfDelivery": program.mode_of_delivery,
        "url": program.url,
    }
    return result


def program_to_simple_format(program: Program) -> dict:
    """Convert to simplified format focused on course planning."""
    # Extract just course codes from requirements
    compulsory_courses = []
    choice_groups = []

    for req in program.requirements:
        if req.type == "compulsory":
            compulsory_courses.extend([c.code for c in req.courses])
        elif req.type == "choose":
            choice_groups.append(
                {"units": req.units, "options": [c.code for c in req.courses]}
            )

    return {
        "code": program.code,
        "name": program.name,
        "totalUnits": program.total_units,
        "duration": program.duration,
        "atar": program.atar,
        "compulsoryCourses": compulsory_courses,
        "choiceGroups": choice_groups,
        "availableMajors": [
            {"code": m.code, "name": m.name} for m in program.available_majors
        ],
        "electiveUnits": sum(
            req.units for req in program.requirements if req.type == "elective"
        ),
        "subjectAreaRequirements": [
            {"subjectArea": req.subject_areas, "units": req.units}
            for req in program.requirements
            if req.type == "subject_area"
        ],
    }


def main():
    parser = argparse.ArgumentParser(
        description="Scrape ANU program/degree information"
    )
    parser.add_argument(
        "programs", nargs="*", help="Program codes to scrape (e.g., aengi)"
    )
    parser.add_argument(
        "--year", type=int, default=2026, help="Academic year (default: 2026)"
    )
    parser.add_argument("--output", "-o", help="Output JSON file")
    parser.add_argument(
        "--format",
        choices=["full", "simple"],
        default="full",
        help="Output format (default: full)",
    )

    args = parser.parse_args()

    if not args.programs:
        parser.print_help()
        print("\nError: No program codes provided", file=sys.stderr)
        sys.exit(1)

    scraper = ANUProgramScraper(year=args.year)
    results = {}

    for code in args.programs:
        print(f"Scraping {code}...", file=sys.stderr)
        program = scraper.scrape_program(code.lower())
        if program:
            if args.format == "full":
                results[code.upper()] = program_to_dict(program)
            else:
                results[code.upper()] = program_to_simple_format(program)
        else:
            print(f"  Failed to scrape {code}", file=sys.stderr)

    output = json.dumps(results, indent=2, default=str)
    if args.output:
        with open(args.output, "w") as f:
            f.write(output)
        print(f"Output written to {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
