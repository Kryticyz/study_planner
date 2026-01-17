import { EquivalenceRegistry } from '../types/prerequisites';

/**
 * Course equivalence registry.
 *
 * Courses in the same group can substitute for each other in:
 * - Prerequisite requirements
 * - Degree requirement fulfillment
 *
 * Note: Equivalent courses are typically also marked as 'incompatible'
 * in the course data to prevent taking both.
 */
export const equivalenceRegistry: EquivalenceRegistry = {
  courseToGroup: {
    // Mathematics - Calculus 1 (standard vs advanced track)
    'MATH1013': 'math-calc-1',
    'MATH1115': 'math-calc-1',

    // Mathematics - Calculus 2 (standard vs advanced track)
    'MATH1014': 'math-calc-2',
    'MATH1116': 'math-calc-2',

    // Physics 1
    'PHYS1101': 'physics-1',
    'PHYS1001': 'physics-1',

    // Introduction to Programming
    'COMP1100': 'comp-intro',
    'COMP1130': 'comp-intro',
  },
  groups: {
    'math-calc-1': ['MATH1013', 'MATH1115'],
    'math-calc-2': ['MATH1014', 'MATH1116'],
    'physics-1': ['PHYS1101', 'PHYS1001'],
    'comp-intro': ['COMP1100', 'COMP1130'],
  }
};

/**
 * Get the equivalence registry singleton.
 */
export function getEquivalenceRegistry(): EquivalenceRegistry {
  return equivalenceRegistry;
}

/**
 * Check if two courses are equivalent (can substitute for each other).
 */
export function areCoursesEquivalent(code1: string, code2: string): boolean {
  if (code1 === code2) return true;

  const group1 = equivalenceRegistry.courseToGroup[code1];
  const group2 = equivalenceRegistry.courseToGroup[code2];

  return group1 !== undefined && group1 === group2;
}

/**
 * Get all courses equivalent to the given course code.
 * Returns an array including the course itself.
 */
export function getEquivalentCourses(courseCode: string): string[] {
  const groupId = equivalenceRegistry.courseToGroup[courseCode];
  if (!groupId) {
    return [courseCode];
  }
  return equivalenceRegistry.groups[groupId] || [courseCode];
}

/**
 * Check if any of the completed courses satisfies a requirement for the target course.
 */
export function hasEquivalentCompleted(
  targetCourseCode: string,
  completedCourses: Set<string>
): boolean {
  // Direct match
  if (completedCourses.has(targetCourseCode)) {
    return true;
  }

  // Check equivalents
  const equivalents = getEquivalentCourses(targetCourseCode);
  return equivalents.some(code => completedCourses.has(code));
}
