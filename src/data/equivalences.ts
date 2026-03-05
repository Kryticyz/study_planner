import type { EquivalenceRegistry } from '../types/prerequisites';
import { courses } from './courses';

/**
 * Build the equivalence registry from course `equivalentTo` fields.
 *
 * Courses in the same group can substitute for each other in:
 * - Prerequisite requirements
 * - Degree requirement fulfillment
 *
 * Note: Equivalent courses are typically also marked as 'incompatible'
 * in the course data to prevent taking both.
 */
export function buildEquivalenceRegistry(): EquivalenceRegistry {
  const courseToGroup: Record<string, string> = {};
  const groups: Record<string, string[]> = {};
  let groupCounter = 0;

  for (const course of Object.values(courses)) {
    if (!course.equivalentTo || course.equivalentTo.length === 0) continue;

    // Skip if this course is already in a group
    if (courseToGroup[course.code]) continue;

    // Check if any equivalent is already in a group
    const existingGroupEquiv = course.equivalentTo.find(eq => courseToGroup[eq]);
    if (existingGroupEquiv) {
      const groupId = courseToGroup[existingGroupEquiv];
      courseToGroup[course.code] = groupId;
      groups[groupId].push(course.code);
    } else {
      // Create a new group
      const groupId = `equiv-${groupCounter++}`;
      const allCodes = [course.code, ...course.equivalentTo];
      for (const code of allCodes) {
        courseToGroup[code] = groupId;
      }
      groups[groupId] = allCodes;
    }
  }

  return { courseToGroup, groups };
}

/** Cached registry, built once on first access */
let cachedRegistry: EquivalenceRegistry | null = null;

/**
 * Get the equivalence registry singleton (derived from course data).
 */
export function getEquivalenceRegistry(): EquivalenceRegistry {
  if (!cachedRegistry) {
    cachedRegistry = buildEquivalenceRegistry();
  }
  return cachedRegistry;
}

/**
 * Check if two courses are equivalent (can substitute for each other).
 */
export function areCoursesEquivalent(code1: string, code2: string): boolean {
  if (code1 === code2) return true;

  const registry = getEquivalenceRegistry();
  const group1 = registry.courseToGroup[code1];
  const group2 = registry.courseToGroup[code2];

  return group1 !== undefined && group1 === group2;
}

/**
 * Get all courses equivalent to the given course code.
 * Returns an array including the course itself.
 */
export function getEquivalentCourses(courseCode: string): string[] {
  const registry = getEquivalenceRegistry();
  const groupId = registry.courseToGroup[courseCode];
  if (!groupId) {
    return [courseCode];
  }
  return registry.groups[groupId] || [courseCode];
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
