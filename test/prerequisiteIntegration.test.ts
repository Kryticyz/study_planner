import { test, expect, describe } from "bun:test";
import { convertLegacyPrerequisites, evaluateExpression } from "../src/utils/prerequisiteEvaluator";
import { createContext, createEmptyContext, expectSatisfied, expectNotSatisfied } from "./testHelpers";
import { courses as compCourses } from "../src/data/courses_comp";
import { Course, CourseType } from "../src/types";

// Helper to create minimal course objects for testing
function createCourse(
  code: string,
  prerequisites: string[] = [],
  prerequisiteAlternatives?: string[][]
): Course {
  return {
    code,
    name: `Test Course ${code}`,
    units: 6,
    level: parseInt(code.match(/\d{4}/)?.[0] || "1000"),
    college: "Test",
    semesters: ["S1"],
    prerequisites,
    prerequisiteAlternatives,
    description: "Test course",
    type: "elective" as CourseType
  };
}

describe("Integration Tests - Full Conversion + Evaluation Pipeline", () => {
  test("Full pipeline - COMP1110 with COMP1100 completed", () => {
    const course = createCourse(
      "COMP1110",
      ["COMP1100"],
      [["COMP1100"], ["COMP1130"]]
    );

    // Convert prerequisites
    const expression = convertLegacyPrerequisites(course);
    expect(expression).toBeDefined();
    expect(expression?.type).toBe('or');

    // Evaluate with COMP1100 completed
    const context = createContext(["COMP1100"]);
    const result = evaluateExpression(expression!, context);
    expectSatisfied(result);
  });

  test("Full pipeline - COMP1110 with COMP1130 completed (equivalent)", () => {
    const course = createCourse(
      "COMP1110",
      ["COMP1100"],
      [["COMP1100"], ["COMP1130"]]
    );

    // Convert prerequisites
    const expression = convertLegacyPrerequisites(course);

    // Evaluate with COMP1130 completed (equivalent to COMP1100)
    const context = createContext(["COMP1130"]);
    const result = evaluateExpression(expression!, context);
    expectSatisfied(result);
  });

  test("Full pipeline - COMP1110 with no courses completed", () => {
    const course = createCourse(
      "COMP1110",
      ["COMP1100"],
      [["COMP1100"], ["COMP1130"]]
    );

    // Convert prerequisites
    const expression = convertLegacyPrerequisites(course);

    // Evaluate with no courses completed
    const context = createEmptyContext();
    const result = evaluateExpression(expression!, context);
    expectNotSatisfied(result);
    expect(result.reason).toContain("One of the following required");
  });

  test("Full pipeline - multiple courses with various contexts", () => {
    // Test COMP1140 (requires COMP1130)
    const comp1140 = createCourse("COMP1140", ["COMP1130"]);
    const expr1140 = convertLegacyPrerequisites(comp1140);

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

    // Test multiple prerequisites (AND)
    const testCourse = createCourse("TEST3000", ["COMP1100", "COMP1110", "COMP2100"]);
    const exprTest = convertLegacyPrerequisites(testCourse);

    // All satisfied
    context = createContext(["COMP1100", "COMP1110", "COMP2100"]);
    result = evaluateExpression(exprTest!, context);
    expectSatisfied(result);

    // One missing
    context = createContext(["COMP1100", "COMP1110"]);
    result = evaluateExpression(exprTest!, context);
    expectNotSatisfied(result, ["COMP2100"]);
  });

  test("All courses in courses_comp.ts convert without errors", () => {
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ code: string; error: any }> = [];

    Object.values(compCourses).forEach(course => {
      try {
        const expression = convertLegacyPrerequisites(course);
        successCount++;

        // If it converted to something, make sure it's a valid structure
        if (expression) {
          expect(expression).toHaveProperty('type');
          expect(['course', 'and', 'or', 'unitLevel']).toContain(expression.type);
        }
      } catch (error) {
        errorCount++;
        errors.push({ code: course.code, error });
      }
    });

    // Report results
    console.log(`Conversion test results: ${successCount} successful, ${errorCount} errors`);
    if (errors.length > 0) {
      console.log('Courses with conversion errors:', errors.map(e => e.code).join(', '));
    }

    // All courses should convert without throwing errors
    expect(errorCount).toBe(0);
  });
});

describe("Integration Tests - Real Course Data Validation", () => {
  test("COMP1100 has no prerequisites", () => {
    const course = compCourses.COMP1100;
    const expression = convertLegacyPrerequisites(course);
    expect(expression).toBeNull();
  });

  test("COMP1110 prerequisiteAlternatives work correctly", () => {
    const course = compCourses.COMP1110;
    const expression = convertLegacyPrerequisites(course);

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
    const expression = convertLegacyPrerequisites(course);

    expect(expression?.type).toBe('course');

    // Should be satisfied with COMP1130
    let context = createContext(["COMP1130"]);
    let result = evaluateExpression(expression!, context);
    expectSatisfied(result);

    // Should be satisfied with COMP1100 (equivalent)
    context = createContext(["COMP1100"]);
    result = evaluateExpression(expression!, context);
    expectSatisfied(result);
  });

  test("Courses with no prerequisites are always satisfied", () => {
    const coursesWithNoPrereqs = Object.values(compCourses).filter(
      c => c.prerequisites.length === 0 && (!c.prerequisiteAlternatives || c.prerequisiteAlternatives.length === 0)
    );

    coursesWithNoPrereqs.forEach(course => {
      const expression = convertLegacyPrerequisites(course);
      expect(expression).toBeNull();

      // When there's no expression, prerequisites should be considered satisfied
      if (!expression) {
        // This is the expected behavior - no prerequisites means always satisfied
        expect(expression).toBeNull();
      }
    });

    expect(coursesWithNoPrereqs.length).toBeGreaterThan(0);
  });
});
