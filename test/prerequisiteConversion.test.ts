import { test, expect, describe } from "bun:test";
import { convertLegacyPrerequisites, courseReq, and, or } from "../src/utils/prerequisiteEvaluator";
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
    level: 1000,
    college: "Test",
    semesters: ["S1"],
    prerequisites,
    prerequisiteAlternatives,
    description: "Test course",
    type: "elective" as CourseType
  };
}

describe("Prerequisite Conversion - Basic Patterns", () => {
  test("Empty prerequisites returns null", () => {
    const course = createCourse("TEST1100", []);
    const result = convertLegacyPrerequisites(course);
    expect(result).toBeNull();
  });

  test("Single prerequisite string converts to CourseRequirement", () => {
    const course = createCourse("TEST1110", ["COMP1100"]);
    const result = convertLegacyPrerequisites(course);
    expect(result).toEqual({ type: 'course', courseCode: 'COMP1100' });
  });

  test("Multiple prerequisite strings convert to AndExpression", () => {
    const course = createCourse("TEST2100", ["COMP1100", "COMP1110"]);
    const result = convertLegacyPrerequisites(course);
    expect(result).toEqual({
      type: 'and',
      operands: [
        { type: 'course', courseCode: 'COMP1100' },
        { type: 'course', courseCode: 'COMP1110' }
      ]
    });
  });

  test("Single prerequisiteAlternative group with one course", () => {
    const course = createCourse("TEST1110", [], [["COMP1100"]]);
    const result = convertLegacyPrerequisites(course);
    expect(result).toEqual({ type: 'course', courseCode: 'COMP1100' });
  });

  test("Single prerequisiteAlternative group with multiple courses", () => {
    const course = createCourse("TEST1110", [], [["COMP1100", "COMP1110"]]);
    const result = convertLegacyPrerequisites(course);
    expect(result).toEqual({
      type: 'and',
      operands: [
        { type: 'course', courseCode: 'COMP1100' },
        { type: 'course', courseCode: 'COMP1110' }
      ]
    });
  });

  test("Multiple prerequisiteAlternative groups convert to OrExpression", () => {
    const course = createCourse("TEST1110", [], [["COMP1100"], ["COMP1130"]]);
    const result = convertLegacyPrerequisites(course);
    expect(result).toEqual({
      type: 'or',
      operands: [
        { type: 'course', courseCode: 'COMP1100' },
        { type: 'course', courseCode: 'COMP1130' }
      ]
    });
  });

  test("COMP1110 pattern - prerequisiteAlternatives takes precedence over prerequisites", () => {
    const course = createCourse(
      "COMP1110",
      ["COMP1100"],
      [["COMP1100"], ["COMP1130"]]
    );
    const result = convertLegacyPrerequisites(course);
    // Should use prerequisiteAlternatives (OR), not prerequisites (single)
    expect(result).toEqual({
      type: 'or',
      operands: [
        { type: 'course', courseCode: 'COMP1100' },
        { type: 'course', courseCode: 'COMP1130' }
      ]
    });
  });

  test("Course with existing prerequisiteExpression returns it unchanged", () => {
    const existingExpr = and(courseReq("COMP1100"), courseReq("COMP2100"));
    const course = {
      ...createCourse("TEST3100", []),
      prerequisiteExpression: existingExpr
    };
    const result = convertLegacyPrerequisites(course);
    expect(result).toEqual(existingExpr);
  });

  test("Empty prerequisiteAlternatives array returns null", () => {
    const course = createCourse("TEST1100", [], []);
    const result = convertLegacyPrerequisites(course);
    expect(result).toBeNull();
  });

  test("Course with undefined prerequisiteAlternatives falls back to prerequisites", () => {
    const course = createCourse("TEST1110", ["COMP1100"], undefined);
    const result = convertLegacyPrerequisites(course);
    expect(result).toEqual({ type: 'course', courseCode: 'COMP1100' });
  });
});

describe("Prerequisite Conversion - Real Course Examples", () => {
  test("COMP1100 - empty prerequisites", () => {
    const course = createCourse("COMP1100", []);
    const result = convertLegacyPrerequisites(course);
    expect(result).toBeNull();
  });

  test("COMP1110 - prerequisiteAlternatives OR pattern", () => {
    const course = createCourse(
      "COMP1110",
      ["COMP1100"],
      [["COMP1100"], ["COMP1130"]]
    );
    const result = convertLegacyPrerequisites(course);
    expect(result).toEqual({
      type: 'or',
      operands: [
        { type: 'course', courseCode: 'COMP1100' },
        { type: 'course', courseCode: 'COMP1130' }
      ]
    });
  });

  test("COMP1130 - empty prerequisites", () => {
    const course = createCourse("COMP1130", []);
    const result = convertLegacyPrerequisites(course);
    expect(result).toBeNull();
  });

  test("COMP1140 - single prerequisite", () => {
    const course = createCourse("COMP1140", ["COMP1130"]);
    const result = convertLegacyPrerequisites(course);
    expect(result).toEqual({ type: 'course', courseCode: 'COMP1130' });
  });

  test("Conversion doesn't crash on multiple alternative groups with multiple courses", () => {
    // Complex OR of ANDs pattern
    const course = createCourse(
      "TEST3000",
      [],
      [
        ["COMP1100", "COMP1110"],
        ["COMP1130", "COMP1140"],
        ["COMP1710"]
      ]
    );
    const result = convertLegacyPrerequisites(course);

    expect(result).toBeDefined();
    expect(result?.type).toBe('or');
    if (result?.type === 'or') {
      expect(result.operands).toHaveLength(3);
      // First operand should be AND of COMP1100 and COMP1110
      expect(result.operands[0]).toEqual({
        type: 'and',
        operands: [
          { type: 'course', courseCode: 'COMP1100' },
          { type: 'course', courseCode: 'COMP1110' }
        ]
      });
      // Second operand should be AND of COMP1130 and COMP1140
      expect(result.operands[1]).toEqual({
        type: 'and',
        operands: [
          { type: 'course', courseCode: 'COMP1130' },
          { type: 'course', courseCode: 'COMP1140' }
        ]
      });
      // Third operand should be single course
      expect(result.operands[2]).toEqual({ type: 'course', courseCode: 'COMP1710' });
    }
  });
});
