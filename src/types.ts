import { PrerequisiteExpression } from './types/prerequisites';

export type Semester = 'S1' | 'S2' | 'Summer' | 'Full Year';

export type SemesterPattern = 'odd_years_only' | 'even_years_only';

export interface Course {
  code: string;
  name: string;
  units: number;
  level: number;
  college: string;
  semesters: Semester[];
  corequisites?: string[];
  incompatible?: string[];
  assumedKnowledge?: string;
  description: string;
  majorRelevance?: string[];
  recommended?: string;
  note?: string;
  semesterPattern?: SemesterPattern;
  offeredYears?: number[];
  semesterSpan?: number;
  honoursWeight?: number;
  /** Expression-based prerequisite */
  prerequisiteExpression?: PrerequisiteExpression;
  /** Other courses this is equivalent to (can substitute for each other) */
  equivalentTo?: string[];
}

export interface PlannedCourse {
  courseCode: string;
  year: number;
  semester: 1 | 2;
  /** Manual override: which degree(s) this course counts toward in double degrees */
  countTowardDegree?: string[];
}

export type ApprovedCreditKind = 'course' | 'unspecified';
export type ApprovedCreditLevel = 1000 | 2000 | 3000 | 4000;

export interface ApprovedCredit {
  id: string;
  kind: ApprovedCreditKind;
  units: number;
  /** Used when kind is 'course' */
  courseCode?: string;
  /** Used when kind is 'unspecified' */
  school?: string;
  /** Used when kind is 'unspecified' */
  level?: ApprovedCreditLevel;
  /** Manual override: which degree(s) this credit counts toward in double degrees */
  countTowardDegree?: string[];
}

export interface StudyPlan {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  startYear: number;
  startSemester: 1 | 2;
  /** Degree program code (e.g., 'AENGI', 'AENGI-BCOMP') */
  program: string;
  courses: PlannedCourse[];
  approvedCredits: ApprovedCredit[];
  selectedMajors?: Record<string, string>;
  completedCourses: string[];
}

export interface ValidationError {
  courseCode: string;
  type: 'prerequisite' | 'semester' | 'incompatible' | 'overload' | 'year' | 'corequisite';
  message: string;
}

export interface RequirementProgress {
  name: string;
  description: string;
  required: number;
  completed: number;
  courses: string[];
  completedCourses: string[];
  remainingUnits?: number;
  eligibleCourses?: string[];
  remainingCourseGroups?: string[][];
}

export interface DegreeProgress {
  foundations: RequirementProgress;
  engineeringFundamentals: RequirementProgress;
  professionalCore: RequirementProgress;
  major: RequirementProgress;
  capstone: RequirementProgress;
  engnElectives: RequirementProgress;
  universityElectives: RequirementProgress;
  total: { required: number; completed: number };
}

/** Progress for a single degree component in a double degree */
export interface DegreeComponentProgress {
  name: string;
  code: string;
  requirements: Record<string, RequirementProgress>;
  selectedMajor?: MajorProgress | null;
  attributedUnits?: number;
  total: { required: number; completed: number };
}

export interface MajorRequirementGroupProgress {
  label: string;
  options: string[];
  satisfiedBy?: string;
}

export interface MajorProgress {
  code: string;
  name: string;
  degreeCode: string;
  required: number;
  completed: number;
  completedCourses: string[];
  eligibleCourses: string[];
  groups: MajorRequirementGroupProgress[];
}

export interface CourseAttributionRow {
  id: string;
  code: string;
  name: string;
  units: number;
  kind: 'planned' | 'approved';
  year?: number;
  semester?: 1 | 2;
  defaultDegreeCodes: string[];
  assignedDegreeCodes: string[];
  usedByDegreeCodes: string[];
  selectedMajorCodes: string[];
  selectedMajorNames: string[];
  isShared: boolean;
  isUnallocated: boolean;
}

/** Combined progress for single or double degrees */
export interface CombinedDegreeProgress {
  programCode: string;
  programName: string;
  isDoubleDegree: boolean;
  /** For single degrees, only primary is populated */
  primary: DegreeComponentProgress;
  /** For double degrees, secondary contains the second degree's progress */
  secondary?: DegreeComponentProgress;
  sharedUnits: number;
  unallocatedUnits: number;
  attributionRows: CourseAttributionRow[];
  /** Overall totals across both degrees */
  overallTotal: { required: number; completed: number };
}

/** Requirement category within a degree */
export interface RequirementCategory {
  name: string;
  description: string;
  units: number;
  /** List of required courses. Array items can be string (required) or string[] (choose one from list) */
  courses?: (string | string[])[];
  /** For elective categories: minimum units from specific course prefixes */
  prefixRequirements?: { prefix: string; minUnits: number }[];
  /** Whether courses in this category are individually mandatory (default true).
   *  Set to false for pool categories like "ICT Related Course" where any one of
   *  many options satisfies the requirement. */
  coursesMandatory?: boolean;
}

/** Configuration for a single degree or degree component */
export interface DegreeConfig {
  code: string;
  name: string;
  totalUnits: number;
  /** Duration in semesters */
  duration: number;
  requirements: Record<string, RequirementCategory>;
}

/** Configuration for available degree programs (single or double) */
export interface ProgramConfig {
  code: string;
  name: string;
  totalUnits: number;
  /** Duration in semesters */
  duration: number;
  isDoubleDegree: boolean;
  /** For single degrees: just the one degree code. For double: both codes */
  degreeComponents: string[];
}

export interface MajorConfig {
  code: string;
  name: string;
  degreeCode: string;
  totalUnits: number;
  courseGroups: string[][];
  aliases?: string[];
}
