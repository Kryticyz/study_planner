# ANU Course & Program Data Format Specification

## Overview

This document describes the recommended data formats for storing ANU course and program information, with special attention to representing complex prerequisite relationships and degree requirements.

---

# Part 1: Course Format

## Revised Format

### Basic Structure

```typescript
interface Course {
  code: string;           // e.g., "ENGN4339"
  name: string;           // e.g., "Aerospace Instrumentation and Avionics"
  units: number;          // Typically 6
  level: number;          // 1000, 2000, 3000, 4000 (derived from code)
  college: string;        // e.g., "Engineering", "Computer Science"
  semesters: string[];    // ["S1"], ["S2"], ["S1", "S2"], ["Summer"]
  prerequisites: PrerequisiteStructure | null;
  description: string;
  type: "core" | "elective" | "major-required";
  majorRelevance: string[];
  
  // Optional extended fields
  areasOfInterest?: string[];
  assumedKnowledge?: string;
  stemCourse?: boolean;
  convener?: string;
  learningOutcomes?: string[];
  assessment?: AssessmentItem[];
  workload?: string;
}
```

### Prerequisite Structure (Key Revision)

The original format used a simple array for prerequisites which couldn't represent OR logic:

```javascript
// OLD FORMAT - limited
prerequisites: ["MATH1013"]
```

**NEW FORMAT** - supports complex logical relationships:

```typescript
interface PrerequisiteStructure {
  // Main prerequisite logic (see below for format)
  requires: PrerequisiteGroup[];
  
  // Original text for reference
  raw: string;
  
  // Optional: courses that can be taken concurrently
  corequisites?: string[];
  
  // Optional: courses that cannot be taken together
  incompatible?: string[];
  
  // Optional: minimum units requirement
  minimumUnits?: number;
  
  // Optional: minimum units at a specific level
  minimumUnitsAtLevel?: { units: number; level: number };
}

// PrerequisiteGroup can be:
// - A string (single course): "MATH1013"
// - An array (OR group): ["MATH1013", "MATH1115"] means MATH1013 OR MATH1115

type PrerequisiteGroup = string | string[];
```

### Prerequisite Logic Rules

1. **Simple AND**: All elements must be completed
   ```javascript
   requires: ["MATH1013", "PHYS1001"]
   // Means: MATH1013 AND PHYS1001
   ```

2. **Simple OR**: Array within array
   ```javascript
   requires: [["MATH1013", "MATH1115"]]
   // Means: MATH1013 OR MATH1115
   ```

3. **Complex AND/OR combinations**:
   ```javascript
   requires: [["MATH1013", "MATH1115"], "PHYS1001"]
   // Means: (MATH1013 OR MATH1115) AND PHYS1001
   ```

4. **Multiple OR groups**:
   ```javascript
   requires: [["MATH1013", "MATH1115"], ["PHYS1001", "PHYS1101"]]
   // Means: (MATH1013 OR MATH1115) AND (PHYS1001 OR PHYS1101)
   ```

## Example Outputs

### Example 1: ENGN4339 (AND prerequisites)

```javascript
{
  "ENGN4339": {
    "code": "ENGN4339",
    "name": "Aerospace Instrumentation and Avionics",
    "units": 6,
    "level": 4000,
    "college": "Engineering",
    "semesters": ["S2"],
    "prerequisites": {
      "requires": ["ENGN2218", "ENGN3338"],
      "raw": "To enrol in this course you must have completed ENGN2218 Electronics Systems and Design and ENGN3338 Aerodynamics"
    },
    "description": "Microcontroller-based instrumentation for aerospace applications, measurement of fluid quantities, avionics systems",
    "type": "elective",
    "majorRelevance": ["AERO-MAJ"],
    "areasOfInterest": ["Engineering", "Mechatronics", "Electronics"],
    "assumedKnowledge": "Basic programming and breadboard-based construction",
    "stemCourse": true
  }
}
```

### Example 2: Course with OR prerequisites

```javascript
{
  "COMP2310": {
    "code": "COMP2310",
    "name": "Systems, Networks and Concurrency",
    "units": 6,
    "level": 2000,
    "college": "Computer Science",
    "semesters": ["S1"],
    "prerequisites": {
      "requires": [["COMP1100", "COMP1130", "COMP1730"]],
      "raw": "COMP1100 or COMP1130 or COMP1730",
      "incompatible": ["COMP2300"]
    },
    "description": "Concurrent programming, systems programming, networking",
    "type": "core",
    "majorRelevance": ["COMP-MAJ"]
  }
}
```

### Example 3: Complex prerequisites with unit requirements

```javascript
{
  "ENGN4200": {
    "code": "ENGN4200",
    "name": "Individual Project",
    "units": 12,
    "level": 4000,
    "college": "Engineering",
    "semesters": ["S1", "S2"],
    "prerequisites": {
      "requires": [["ENGN3200", "ENGN2707"]],
      "raw": "Completion of 96 units including ENGN3200 or ENGN2707",
      "minimumUnits": 96
    },
    "description": "Individual engineering research project",
    "type": "core",
    "majorRelevance": ["ENGN-MAJ"]
  }
}
```

### Example 4: Your original format (backward compatible)

The simple format still works for courses with simple AND prerequisites:

```javascript
{
  "ENGN2228": {
    "code": "ENGN2228",
    "name": "Signals and Systems",
    "units": 6,
    "level": 2000,
    "college": "Engineering",
    "semesters": ["S2"],
    "prerequisites": {
      "requires": ["MATH1013"],
      "raw": "MATH1013"
    },
    "description": "Fourier analysis, LTI systems, Laplace transforms, frequency response",
    "type": "core",
    "majorRelevance": ["ECSY-MAJ"]
  }
}
```

## Validation Function

Here's a TypeScript/JavaScript function to check if prerequisites are satisfied:

```typescript
function prerequisitesSatisfied(
  prereqs: PrerequisiteStructure | null,
  completedCourses: string[],
  completedUnits: number = 0
): boolean {
  if (!prereqs) return true;
  
  // Check minimum units
  if (prereqs.minimumUnits && completedUnits < prereqs.minimumUnits) {
    return false;
  }
  
  // Check each requirement group
  for (const requirement of prereqs.requires) {
    if (Array.isArray(requirement)) {
      // OR group - at least one must be completed
      const orSatisfied = requirement.some(course => 
        completedCourses.includes(course)
      );
      if (!orSatisfied) return false;
    } else {
      // Single course - must be completed
      if (!completedCourses.includes(requirement)) return false;
    }
  }
  
  // Check incompatibilities
  if (prereqs.incompatible) {
    for (const course of prereqs.incompatible) {
      if (completedCourses.includes(course)) return false;
    }
  }
  
  return true;
}
```

## Migration from Old Format

To convert from the simple array format:

```javascript
function migratePrerequisites(oldPrereqs: string[]): PrerequisiteStructure {
  return {
    requires: oldPrereqs,  // Simple AND - works directly
    raw: oldPrereqs.join(", ")
  };
}
```

## Additional Fields for Extended Use

For more comprehensive course planning, consider adding:

```typescript
interface ExtendedCourse extends Course {
  // Detailed offerings
  offerings: {
    year: number;
    semester: string;
    mode: "In Person" | "Online" | "Hybrid";
    classNumber?: string;
    startDate?: string;
    endDate?: string;
  }[];
  
  // Assessment breakdown
  assessment: {
    description: string;
    weight: number;  // Percentage
    type?: "exam" | "assignment" | "project" | "lab" | "participation";
  }[];
  
  // Learning outcomes
  learningOutcomes: string[];
  
  // Workload description
  workload: string;
  
  // Prescribed texts
  prescribedTexts: string[];
  
  // Course fees
  fees: {
    domestic: number;
    international: number;
  };
  
  // URL for reference
  url: string;
}
```

## Scraper Output Modes

The scraper supports two output formats:

1. **Simple** (`--format simple`): Compact format suitable for course planning apps
2. **Full** (`--format full`): Complete data including all extracted fields

Run with `--format full` for comprehensive data extraction.

---

# Part 2: Program/Degree Format

## Program Structure

```typescript
interface Program {
  code: string;              // e.g., "AENGI"
  name: string;              // e.g., "Bachelor of Engineering (Honours)"
  postNominal: string;       // e.g., "BEngHons"
  duration: string;          // e.g., "4 year full-time"
  totalUnits: number;        // e.g., 192
  max1000LevelUnits: number; // e.g., 60
  
  admission: AdmissionInfo;
  classification: ClassificationInfo;
  codes: AcademicCodes;
  
  requirements: RequirementGroup[];
  availableMajors: Major[];
  studyPlans: StudyPlanSemester[];
  honoursInfo?: HonoursInfo;
  
  description: string;
  learningOutcomes: string[];
  careerOptions: string;
  
  academicContact: string;
  modeOfDelivery: string;
  url: string;
}
```

## Requirement Types

The `requirements` array contains different types of requirements:

### 1. Compulsory Courses
All listed courses must be completed.

```javascript
{
  "type": "compulsory",
  "units": 72,
  "description": "72 units from completion of the following compulsory courses",
  "courses": [
    { "code": "ENGN1211", "name": "Engineering Design 1", "units": 6 },
    { "code": "ENGN1217", "name": "Introduction to Mechanics", "units": 6 }
    // ...
  ]
}
```

### 2. Choice Groups
Select from a list to meet the unit requirement.

```javascript
{
  "type": "choose",
  "units": 6,
  "description": "6 units from completion of a course from the following list",
  "courses": [
    { "code": "COMP1100", "name": "Programming as Problem Solving", "units": 6 },
    { "code": "COMP1130", "name": "Programming as Problem Solving (Advanced)", "units": 6 },
    { "code": "COMP1730", "name": "Programming for Scientists", "units": 6 }
  ]
}
```

### 3. Major Requirements
Complete one of the listed majors.

```javascript
{
  "type": "major",
  "units": 48,
  "description": "48 units from completion of one of the following Engineering majors",
  "majors": ["ASSY-MAJ", "ELCO-MAJ", "ESYS-MAJ", "INES-MAJ", "MTSY-MAJ", "NUSY-MAJ", "RENE-MAJ"],
  "note": "12 units overlap with compulsory requirements"
}
```

### 4. Subject Area Requirements
Complete courses from specified subject areas.

```javascript
{
  "type": "subject_area",
  "units": 24,
  "description": "24 units from completion of courses from ENGN Engineering",
  "subjectAreas": ["ENGN"]
}
```

### 5. Free Electives
Any courses offered by the university.

```javascript
{
  "type": "elective",
  "units": 24,
  "description": "24 units from completion of elective courses offered by ANU"
}
```

## Study Plan Format

```typescript
interface StudyPlanSemester {
  year: number;      // 1, 2, 3, 4
  semester: number;  // 1 or 2
  courses: StudyPlanCourse[];
}

interface StudyPlanCourse {
  code: string;          // Empty string for placeholders
  name: string;          // e.g., "Elective Course" for placeholders
  units: number;
  isPlaceholder: boolean;
}
```

## Honours Information

```typescript
interface HonoursInfo {
  enrolmentCourse: string;      // e.g., "ENGN4100"
  calculationMethod: string;    // WAM formula description
  weightings: {
    foundations: number;        // e.g., 0.1
    fundamentals: number;       // e.g., 0.2
    professionalCore: number;   // e.g., 0.3
    discipline: number;         // e.g., 0.4
  };
}
```

## Validation Function

```typescript
function validateProgramCompletion(
  program: Program,
  completedCourses: { code: string; units: number }[],
  selectedMajor: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const completedCodes = new Set(completedCourses.map(c => c.code));
  const totalUnits = completedCourses.reduce((sum, c) => sum + c.units, 0);
  
  // Check total units
  if (totalUnits < program.totalUnits) {
    errors.push(`Need ${program.totalUnits - totalUnits} more units`);
  }
  
  // Check 1000-level limit
  const level1000Units = completedCourses
    .filter(c => /^[A-Z]{4}1/.test(c.code))
    .reduce((sum, c) => sum + c.units, 0);
  if (level1000Units > program.max1000LevelUnits) {
    errors.push(`Exceeded 1000-level limit by ${level1000Units - program.max1000LevelUnits} units`);
  }
  
  // Check each requirement
  for (const req of program.requirements) {
    if (req.type === "compulsory") {
      for (const course of req.courses) {
        if (!completedCodes.has(course.code)) {
          errors.push(`Missing compulsory course: ${course.code}`);
        }
      }
    } else if (req.type === "choose") {
      const completed = req.courses.filter(c => completedCodes.has(c.code));
      const units = completed.reduce((sum, c) => sum + c.units, 0);
      if (units < req.units) {
        errors.push(`Need ${req.units - units} more units from: ${req.description}`);
      }
    } else if (req.type === "major") {
      if (!req.majors.includes(selectedMajor)) {
        errors.push(`Invalid major selection: ${selectedMajor}`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}
```

## Usage

```bash
# Scrape a program
python anu_program_scraper.py aengi

# Multiple programs
python anu_program_scraper.py aengi bcomm --year 2026 --output programs.json

# Simple format (just codes and units)
python anu_program_scraper.py aengi --format simple
```
