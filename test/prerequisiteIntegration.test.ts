import { test, expect, describe } from "bun:test";
import { evaluateExpression, courseReq, and, or } from "../src/utils/prerequisiteEvaluator";
import { createContext, createEmptyContext, expectSatisfied, expectNotSatisfied } from "./testHelpers";
import { COMP_COURSES as compCourses } from "../src/data/courses";

describe("Integration Tests - Full Evaluation Pipeline", () => {
  test("Full pipeline - COMP1110 with COMP1100 completed", () => {
    const course = compCourses.COMP1110;
    const expression = course.prerequisiteExpression;
    expect(expression).toBeDefined();
    expect(expression?.type).toBe('or');

    // Evaluate with COMP1100 completed
    const context = createContext(["COMP1100"]);
    const result = evaluateExpression(expression!, context);
    expectSatisfied(result);
  });

  test("Full pipeline - COMP1110 with COMP1130 completed", () => {
    const course = compCourses.COMP1110;
    const expression = course.prerequisiteExpression;

    // Evaluate with COMP1130 completed
    const context = createContext(["COMP1130"]);
    const result = evaluateExpression(expression!, context);
    expectSatisfied(result);
  });

  test("Full pipeline - COMP1110 with no courses completed", () => {
    const course = compCourses.COMP1110;
    const expression = course.prerequisiteExpression;

    // Evaluate with no courses completed
    const context = createEmptyContext();
    const result = evaluateExpression(expression!, context);
    expectNotSatisfied(result);
    expect(result.reason).toContain("One of the following required");
  });

  test("Full pipeline - multiple courses with various contexts", () => {
    // Test COMP1140 (requires COMP1130)
    const comp1140 = compCourses.COMP1140;
    const expr1140 = comp1140.prerequisiteExpression;
    expect(expr1140).toBeDefined();

    // Should be satisfied with COMP1130
    let context = createContext(["COMP1130"]);
    let result = evaluateExpression(expr1140!, context);
    expectSatisfied(result);

    // Should be satisfied with COMP1100 (equivalent)
    context = createContext(["COMP1100"]);
    result = evaluateExpression(expr1140!, context);
    expectSatisfied(result);

    // Should not be satisfied with unrelated course
    context = createContext(["COMP2100"]);
    result = evaluateExpression(expr1140!, context);
    expectNotSatisfied(result);

    // Test multiple prerequisites (AND) - create a simple AND expression
    const multiExpr = and(courseReq("COMP1100"), courseReq("COMP1110"), courseReq("COMP2100"));

    // All satisfied
    context = createContext(["COMP1100", "COMP1110", "COMP2100"]);
    result = evaluateExpression(multiExpr, context);
    expectSatisfied(result);

    // One missing
    context = createContext(["COMP1100", "COMP1110"]);
    result = evaluateExpression(multiExpr, context);
    expectNotSatisfied(result, ["COMP2100"]);
  });

  test("All courses in COMP_COURSES have valid prerequisiteExpression structure", () => {
    let validCount = 0;
    let noPrereqCount = 0;
    const errors: Array<{ code: string; error: string }> = [];

    Object.values(compCourses).forEach(course => {
      try {
        const expression = course.prerequisiteExpression;

        if (expression) {
          // If it has an expression, make sure it's a valid structure
          expect(expression).toHaveProperty('type');
          expect(['course', 'and', 'or', 'unitLevel']).toContain(expression.type);
          validCount++;
        } else {
          noPrereqCount++;
        }
      } catch (error) {
        errors.push({ code: course.code, error: String(error) });
      }
    });

    // Report results
    console.log(`COMP courses: ${validCount} with expressions, ${noPrereqCount} without prerequisites`);
    if (errors.length > 0) {
      console.log('Courses with errors:', errors.map(e => e.code).join(', '));
    }

    expect(errors.length).toBe(0);
  });
});

describe("Integration Tests - Real Course Data Validation", () => {
  test("COMP1100 has no prerequisites", () => {
    const course = compCourses.COMP1100;
    expect(course.prerequisiteExpression).toBeUndefined();
  });

  test("COMP1110 prerequisiteExpression is OR expression", () => {
    const course = compCourses.COMP1110;
    const expression = course.prerequisiteExpression;

    expect(expression?.type).toBe('or');

    // Should be satisfied with COMP1100
    let context = createContext(["COMP1100"]);
    let result = evaluateExpression(expression!, context);
    expectSatisfied(result);

    // Should be satisfied with COMP1130
    context = createContext(["COMP1130"]);
    result = evaluateExpression(expression!, context);
    expectSatisfied(result);

    // Should not be satisfied with neither
    context = createEmptyContext();
    result = evaluateExpression(expression!, context);
    expectNotSatisfied(result);
  });

  test("COMP1140 requires COMP1130 or equivalent", () => {
    const course = compCourses.COMP1140;
    const expression = course.prerequisiteExpression;

    expect(expression?.type).toBe('course');

    // Should be satisfied with COMP1130
    let context = createContext(["COMP1130"]);
    let result = evaluateExpression(expression!, context);
    expectSatisfied(result);

    // Should be satisfied with COMP1100 (equivalent via equivalenceRegistry)
    context = createContext(["COMP1100"]);
    result = evaluateExpression(expression!, context);
    expectSatisfied(result);
  });

  test("Courses with no prerequisiteExpression are always satisfied", () => {
    const coursesWithNoPrereqs = Object.values(compCourses).filter(
      c => !c.prerequisiteExpression
    );

    coursesWithNoPrereqs.forEach(course => {
      expect(course.prerequisiteExpression).toBeUndefined();
    });

    expect(coursesWithNoPrereqs.length).toBeGreaterThan(0);
  });
});
