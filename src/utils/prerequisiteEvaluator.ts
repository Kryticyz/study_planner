import {
  PrerequisiteExpression,
  CourseRequirement,
  AndExpression,
  OrExpression,
  UnitLevelRequirement,
  EvaluationContext,
  EvaluationResult,
} from '../types/prerequisites';
import { Course } from '../types';
import { getEquivalentCourses } from '../data/equivalences';

/**
 * Recursively evaluates a prerequisite expression against the evaluation context.
 */
export function evaluateExpression(
  expr: PrerequisiteExpression,
  context: EvaluationContext
): EvaluationResult {
  switch (expr.type) {
    case 'course':
      return evaluateCourseRequirement(expr, context);
    case 'and':
      return evaluateAndExpression(expr, context);
    case 'or':
      return evaluateOrExpression(expr, context);
    case 'unitLevel':
      return evaluateUnitLevelRequirement(expr, context);
    default:
      return { satisfied: false, reason: 'Unknown expression type' };
  }
}

function evaluateCourseRequirement(
  expr: CourseRequirement,
  context: EvaluationContext
): EvaluationResult {
  // Check direct completion
  if (context.completedCourses.has(expr.courseCode)) {
    return { satisfied: true };
  }

  // Check equivalents
  const equivalents = getEquivalentCourses(expr.courseCode);
  for (const equiv of equivalents) {
    if (context.completedCourses.has(equiv)) {
      return { satisfied: true };
    }
  }

  return {
    satisfied: false,
    reason: `Missing: ${expr.courseCode}`,
    details: { missingCourses: [expr.courseCode] }
  };
}

function evaluateAndExpression(
  expr: AndExpression,
  context: EvaluationContext
): EvaluationResult {
  const missingCourses: string[] = [];
  const failedReasons: string[] = [];

  for (const operand of expr.operands) {
    const result = evaluateExpression(operand, context);
    if (!result.satisfied) {
      if (result.details?.missingCourses) {
        missingCourses.push(...result.details.missingCourses);
      }
      if (result.reason) {
        failedReasons.push(result.reason);
      }
    }
  }

  if (missingCourses.length > 0 || failedReasons.length > 0) {
    return {
      satisfied: false,
      reason: failedReasons.join('; '),
      details: missingCourses.length > 0 ? { missingCourses } : undefined
    };
  }

  return { satisfied: true };
}

function evaluateOrExpression(
  expr: OrExpression,
  context: EvaluationContext
): EvaluationResult {
  for (const operand of expr.operands) {
    const result = evaluateExpression(operand, context);
    if (result.satisfied) {
      return { satisfied: true };
    }
  }

  return {
    satisfied: false,
    reason: `One of the following required: ${describeExpression(expr)}`
  };
}

function evaluateUnitLevelRequirement(
  expr: UnitLevelRequirement,
  context: EvaluationContext
): EvaluationResult {
  let totalUnits = 0;

  for (const course of context.completedCoursesData) {
    // Check level matches
    let levelMatch = false;
    switch (expr.levelOperator) {
      case 'exact':
        levelMatch = course.level === expr.level;
        break;
      case 'atLeast':
        levelMatch = course.level >= expr.level;
        break;
      case 'atMost':
        levelMatch = course.level <= expr.level;
        break;
    }

    // Check prefix if specified
    const prefixMatch = !expr.coursePrefix ||
      course.code.startsWith(expr.coursePrefix);

    if (levelMatch && prefixMatch) {
      totalUnits += course.units;
    }
  }

  if (totalUnits >= expr.minUnits) {
    return { satisfied: true };
  }

  const levelStr = expr.levelOperator === 'atLeast' ? `${expr.level}+` :
                   expr.levelOperator === 'atMost' ? `${expr.level}-` :
                   `${expr.level}`;
  const prefix = expr.coursePrefix ? ` ${expr.coursePrefix}` : '';

  return {
    satisfied: false,
    reason: `Need ${expr.minUnits} units of${prefix} ${levelStr}-level courses, have ${totalUnits}`,
    details: {
      missingUnits: { level: expr.level, required: expr.minUnits, have: totalUnits }
    }
  };
}

/**
 * Generates a human-readable description of a prerequisite expression.
 * Used for UI display.
 */
export function describeExpression(expr: PrerequisiteExpression): string {
  switch (expr.type) {
    case 'course':
      return expr.courseCode;
    case 'and':
      if (expr.operands.length === 0) return 'None';
      if (expr.operands.length === 1) return describeExpression(expr.operands[0]);
      return expr.operands.map(op => {
        const desc = describeExpression(op);
        // Wrap OR expressions in parentheses for clarity
        return op.type === 'or' ? `(${desc})` : desc;
      }).join(' AND ');
    case 'or':
      if (expr.operands.length === 0) return 'None';
      if (expr.operands.length === 1) return describeExpression(expr.operands[0]);
      return expr.operands.map(describeExpression).join(' OR ');
    case 'unitLevel': {
      const levelStr = expr.levelOperator === 'atLeast' ? `${expr.level}+` :
                       expr.levelOperator === 'atMost' ? `${expr.level}-` :
                       `${expr.level}`;
      const prefix = expr.coursePrefix ? ` ${expr.coursePrefix}` : '';
      return `${expr.minUnits} units of${prefix} ${levelStr}-level courses`;
    }
    default:
      return 'Unknown requirement';
  }
}

/**
 * Converts legacy prerequisite format to expression tree.
 * This ensures backwards compatibility with existing course data.
 */
export function convertLegacyPrerequisites(course: Course): PrerequisiteExpression | null {
  // If new format exists, use it directly
  if (course.prerequisiteExpression) {
    return course.prerequisiteExpression;
  }

  // Handle prerequisiteAlternatives (OR between groups, AND within)
  if (course.prerequisiteAlternatives && course.prerequisiteAlternatives.length > 0) {
    const orOperands: PrerequisiteExpression[] = course.prerequisiteAlternatives.map(group => {
      if (group.length === 1) {
        return { type: 'course', courseCode: group[0] } as CourseRequirement;
      }
      return {
        type: 'and',
        operands: group.map(code => ({ type: 'course', courseCode: code } as CourseRequirement))
      } as AndExpression;
    });

    if (orOperands.length === 1) {
      return orOperands[0];
    }

    return { type: 'or', operands: orOperands } as OrExpression;
  }

  // Handle simple prerequisites (all AND)
  if (course.prerequisites.length > 0) {
    if (course.prerequisites.length === 1) {
      return { type: 'course', courseCode: course.prerequisites[0] };
    }
    return {
      type: 'and',
      operands: course.prerequisites.map(code => ({ type: 'course', courseCode: code }))
    };
  }

  return null;
}

/**
 * Helper to create a course requirement expression.
 */
export function courseReq(code: string): CourseRequirement {
  return { type: 'course', courseCode: code };
}

/**
 * Helper to create an AND expression.
 */
export function and(...operands: PrerequisiteExpression[]): AndExpression {
  return { type: 'and', operands };
}

/**
 * Helper to create an OR expression.
 */
export function or(...operands: PrerequisiteExpression[]): OrExpression {
  return { type: 'or', operands };
}

/**
 * Helper to create a unit level requirement.
 */
export function unitLevel(
  minUnits: number,
  level: number,
  levelOperator: 'exact' | 'atLeast' | 'atMost' = 'atLeast',
  coursePrefix?: string
): UnitLevelRequirement {
  return { type: 'unitLevel', minUnits, level, levelOperator, coursePrefix };
}
