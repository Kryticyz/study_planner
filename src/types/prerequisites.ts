/**
 * Prerequisite Expression Types
 *
 * A tree-based structure for representing complex prerequisite requirements
 * including AND/OR logic, unit level requirements, and course equivalences.
 */

/**
 * Base union type for all prerequisite expression nodes.
 * Uses discriminated unions for type-safe pattern matching.
 */
export type PrerequisiteExpression =
  | CourseRequirement
  | AndExpression
  | OrExpression
  | UnitLevelRequirement;

/**
 * Requires a specific course to be completed.
 */
export interface CourseRequirement {
  type: 'course';
  courseCode: string;
}

/**
 * All child expressions must be satisfied (AND logic).
 */
export interface AndExpression {
  type: 'and';
  operands: PrerequisiteExpression[];
}

/**
 * At least one child expression must be satisfied (OR logic).
 */
export interface OrExpression {
  type: 'or';
  operands: PrerequisiteExpression[];
}

/**
 * Requires minimum units at a specific level.
 *
 * Examples:
 *   - "48 units of 2000-level courses" -> { minUnits: 48, level: 2000, levelOperator: 'exact' }
 *   - "24 units of 3000-level or above" -> { minUnits: 24, level: 3000, levelOperator: 'atLeast' }
 *   - "12 units of ENGN 2000+ courses" -> { minUnits: 12, level: 2000, levelOperator: 'atLeast', coursePrefix: 'ENGN' }
 */
export interface UnitLevelRequirement {
  type: 'unitLevel';
  minUnits: number;
  level: number;
  levelOperator: 'exact' | 'atLeast' | 'atMost';
  coursePrefix?: string;
}

/**
 * Equivalence registry for courses that can substitute for each other.
 */
// TODO remove equivalence registry
export interface EquivalenceRegistry {
  /** Map from course code to its equivalence group ID */
  courseToGroup: Record<string, string>;
  /** Map from group ID to all courses in that group */
  groups: Record<string, string[]>;
}

/**
 * Context provided to the expression evaluator.
 */
export interface EvaluationContext {
  /** Set of course codes completed before the target semester */
  completedCourses: Set<string>;
  /** Full course data for completed courses (for unit calculations) */
  completedCoursesData: Array<{ code: string; units: number; level: number }>;
  /** Equivalence registry for course substitutions */
  equivalenceRegistry: EquivalenceRegistry;
}

/**
 * Result of evaluating a prerequisite expression.
 */
export interface EvaluationResult {
  satisfied: boolean;
  reason?: string;
  details?: {
    missingCourses?: string[];
    missingUnits?: { level: number; required: number; have: number };
  };
}
