import { EvaluationContext, EvaluationResult } from '../src/types/prerequisites';
import { getEquivalenceRegistry } from '../src/data/equivalences';
import { expect } from 'bun:test';

/**
 * Creates an evaluation context with the given completed course codes.
 * All courses default to 6 units and level is inferred from course code.
 */
export function createContext(completedCodes: string[]): EvaluationContext {
  return {
    completedCourses: new Set(completedCodes),
    completedCoursesData: completedCodes.map(code => ({
      code,
      units: 6,
      level: inferLevelFromCode(code)
    })),
    equivalenceRegistry: getEquivalenceRegistry()
  };
}

/**
 * Creates an evaluation context with custom unit and level data.
 */
export function createContextWithUnits(
  courses: Array<{ code: string; units: number; level: number }>
): EvaluationContext {
  return {
    completedCourses: new Set(courses.map(c => c.code)),
    completedCoursesData: courses,
    equivalenceRegistry: getEquivalenceRegistry()
  };
}

/**
 * Creates an empty evaluation context with no completed courses.
 */
export function createEmptyContext(): EvaluationContext {
  return {
    completedCourses: new Set(),
    completedCoursesData: [],
    equivalenceRegistry: getEquivalenceRegistry()
  };
}

/**
 * Infers course level from course code.
 * Assumes format like COMP1100 where the first digit after letters is the level.
 */
function inferLevelFromCode(code: string): number {
  const match = code.match(/(\d{4})/);
  if (match) {
    return parseInt(match[1]);
  }
  // Default to 1000 level if we can't parse
  return 1000;
}

/**
 * Assertion helper: Expects result to be satisfied.
 */
export function expectSatisfied(result: EvaluationResult) {
  expect(result.satisfied).toBe(true);
}

/**
 * Assertion helper: Expects result to not be satisfied.
 * Optionally checks for expected missing courses.
 */
export function expectNotSatisfied(
  result: EvaluationResult,
  expectedMissingCourses?: string[]
) {
  expect(result.satisfied).toBe(false);
  if (expectedMissingCourses) {
    expect(result.details?.missingCourses).toEqual(expectedMissingCourses);
  }
}

/**
 * Assertion helper: Expects result to not be satisfied due to missing units.
 */
export function expectMissingUnits(
  result: EvaluationResult,
  level: number,
  required: number,
  have: number
) {
  expect(result.satisfied).toBe(false);
  expect(result.details?.missingUnits).toEqual({ level, required, have });
}

/**
 * Pre-defined test contexts for common scenarios.
 */
export const TEST_CONTEXTS = {
  empty: createEmptyContext(),
  firstYearComp: createContext(['COMP1100', 'COMP1110']),
  secondYearComp: createContext(['COMP1100', 'COMP1110', 'COMP2100', 'COMP2310']),
  withEquivalents: createContext(['COMP1130', 'COMP1140']), // advanced versions
  mixedDisciplines: createContext(['COMP1100', 'MATH1115', 'ENGN2219']),
  highLevelUnits: createContextWithUnits([
    { code: 'COMP2100', units: 6, level: 2000 },
    { code: 'COMP2310', units: 6, level: 2000 },
    { code: 'COMP3600', units: 6, level: 3000 },
    { code: 'COMP3620', units: 6, level: 3000 },
  ])
};
