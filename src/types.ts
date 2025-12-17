export type Semester = 'S1' | 'S2' | 'Summer' | 'Full Year';

export type CourseType =
  | 'foundation'
  | 'core'
  | 'professionalCore'
  | 'major'
  | 'elective'
  | 'engnElective'
  | 'capstone'
  | 'industryExperience';

export type SemesterPattern = 'odd_years_only' | 'even_years_only';

export interface Course {
  code: string;
  name: string;
  units: number;
  level: number;
  college: string;
  semesters: Semester[];
  prerequisites: string[];
  prerequisiteAlternatives?: string[][];
  corequisites?: string[];
  incompatible?: string[];
  assumedKnowledge?: string;
  description: string;
  type: CourseType;
  majorRelevance?: string[];
  recommended?: string;
  note?: string;
  semesterPattern?: SemesterPattern;
  offeredYears?: number[];
  semesterSpan?: number;
  honoursWeight?: number;
}

export interface PlannedCourse {
  courseCode: string;
  year: number;
  semester: 1 | 2;
}

export interface StudyPlan {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  startYear: number;
  courses: PlannedCourse[];
  completedCourses: string[];
}

export interface ValidationError {
  courseCode: string;
  type: 'prerequisite' | 'semester' | 'incompatible' | 'overload' | 'year';
  message: string;
}

export interface RequirementProgress {
  name: string;
  description: string;
  required: number;
  completed: number;
  courses: string[];
  completedCourses: string[];
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
