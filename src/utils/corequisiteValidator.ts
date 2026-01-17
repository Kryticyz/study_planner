import { Course, StudyPlan, ValidationError } from '../types';
import { getEquivalentCourses } from '../data/equivalences';

/**
 * Get the chronological position of a semester in a study plan.
 * This matches the logic in planStore.ts.
 */
function getChronologicalPosition(year: number, semester: 1 | 2, startSemester: 1 | 2): number {
  const semesterOffset = startSemester === 1 ? semester : (semester === 2 ? 1 : 2);
  return (year - 1) * 2 + semesterOffset;
}

/**
 * Get all courses in the same semester.
 */
function getSameSemesterCourses(
  plan: StudyPlan,
  year: number,
  semester: 1 | 2
): string[] {
  return plan.courses
    .filter(c => c.year === year && c.semester === semester)
    .map(c => c.courseCode);
}

/**
 * Get all courses in prior semesters.
 */
function getPriorCourses(
  plan: StudyPlan,
  year: number,
  semester: 1 | 2
): string[] {
  const startSemester = plan.startSemester ?? 1;
  const targetPosition = getChronologicalPosition(year, semester, startSemester);

  return plan.courses
    .filter(c => getChronologicalPosition(c.year, c.semester, startSemester) < targetPosition)
    .map(c => c.courseCode);
}

/**
 * Check if a corequisite is satisfied (exists in same semester or prior).
 * Also checks for equivalent courses.
 */
function isCorequisiteSatisfied(
  corequisiteCode: string,
  sameSemesterCourses: Set<string>,
  priorCourses: Set<string>,
  completedCourses: Set<string>
): boolean {
  // Get all equivalent courses for the corequisite
  const equivalents = getEquivalentCourses(corequisiteCode);

  for (const code of equivalents) {
    // Check same semester
    if (sameSemesterCourses.has(code)) {
      return true;
    }
    // Check prior semesters
    if (priorCourses.has(code)) {
      return true;
    }
    // Check already completed courses (not in plan)
    if (completedCourses.has(code)) {
      return true;
    }
  }

  return false;
}

/**
 * Validates corequisites for a course in a plan.
 *
 * Corequisites must be taken in the same semester OR in a prior semester.
 * This is the "non-strict" corequisite semantics.
 *
 * @param courseCode The course being validated
 * @param course The course data
 * @param year The year the course is planned
 * @param semester The semester the course is planned
 * @param plan The study plan
 * @returns Array of validation errors for corequisite violations
 */
export function validateCorequisites(
  courseCode: string,
  course: Course,
  year: number,
  semester: 1 | 2,
  plan: StudyPlan
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Skip if no corequisites defined
  if (!course.corequisites || course.corequisites.length === 0) {
    return errors;
  }

  // Get courses for comparison
  const sameSemester = new Set(getSameSemesterCourses(plan, year, semester));
  const prior = new Set(getPriorCourses(plan, year, semester));
  const completed = new Set(plan.completedCourses);

  for (const coreq of course.corequisites) {
    if (!isCorequisiteSatisfied(coreq, sameSemester, prior, completed)) {
      errors.push({
        courseCode,
        type: 'corequisite',
        message: `Corequisite ${coreq} not scheduled concurrently or before`,
      });
    }
  }

  return errors;
}

/**
 * Validates all corequisites in a plan.
 *
 * @param plan The study plan
 * @param allCourses The course catalog
 * @returns Array of all corequisite validation errors
 */
export function validateAllCorequisites(
  plan: StudyPlan,
  allCourses: Record<string, Course>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const pc of plan.courses) {
    const course = allCourses[pc.courseCode];
    if (!course) continue;

    const courseErrors = validateCorequisites(
      pc.courseCode,
      course,
      pc.year,
      pc.semester,
      plan
    );
    errors.push(...courseErrors);
  }

  return errors;
}
