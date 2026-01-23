import { test, expect, describe } from "bun:test";
import { courseReq, and, or, unitLevel, describeExpression } from "../src/utils/prerequisiteEvaluator";

describe("Helper Functions - Expression Builders", () => {
  test("courseReq() creates correct CourseRequirement structure", () => {
    const result = courseReq("COMP1100");
    expect(result).toEqual({
      type: 'course',
      courseCode: 'COMP1100'
    });
  });

  test("and() creates correct AndExpression with multiple operands", () => {
    const result = and(
      courseReq("COMP1100"),
      courseReq("COMP1110"),
      courseReq("COMP2100")
    );
    expect(result).toEqual({
      type: 'and',
      operands: [
        { type: 'course', courseCode: 'COMP1100' },
        { type: 'course', courseCode: 'COMP1110' },
        { type: 'course', courseCode: 'COMP2100' }
      ]
    });
  });

  test("or() creates correct OrExpression with multiple operands", () => {
    const result = or(
      courseReq("COMP1100"),
      courseReq("COMP1130")
    );
    expect(result).toEqual({
      type: 'or',
      operands: [
        { type: 'course', courseCode: 'COMP1100' },
        { type: 'course', courseCode: 'COMP1130' }
      ]
    });
  });

  test("unitLevel() creates correct UnitLevelRequirement structure", () => {
    const result = unitLevel(12, 2000, 'atLeast', 'COMP');
    expect(result).toEqual({
      type: 'unitLevel',
      minUnits: 12,
      level: 2000,
      levelOperator: 'atLeast',
      coursePrefix: 'COMP'
    });
  });

  test("unitLevel() with default levelOperator", () => {
    const result = unitLevel(24, 3000);
    expect(result).toEqual({
      type: 'unitLevel',
      minUnits: 24,
      level: 3000,
      levelOperator: 'atLeast',
      coursePrefix: undefined
    });
  });
});

describe("Helper Functions - Description Generator", () => {
  test("describeExpression() - simple course", () => {
    const expr = courseReq("COMP1100");
    const result = describeExpression(expr);
    expect(result).toBe("COMP1100");
  });

  test("describeExpression() - AND expression", () => {
    const expr = and(courseReq("COMP1100"), courseReq("COMP2100"));
    const result = describeExpression(expr);
    expect(result).toBe("COMP1100 AND COMP2100");
  });

  test("describeExpression() - OR expression", () => {
    const expr = or(courseReq("COMP1100"), courseReq("COMP1130"));
    const result = describeExpression(expr);
    expect(result).toBe("COMP1100 OR COMP1130");
  });

  test("describeExpression() - complex nested with proper parentheses", () => {
    // AND of ORs should wrap the ORs in parentheses
    const expr = and(
      or(courseReq("COMP1100"), courseReq("COMP1130")),
      courseReq("COMP2100")
    );
    const result = describeExpression(expr);
    expect(result).toBe("(COMP1100 OR COMP1130) AND COMP2100");
  });

  test("describeExpression() - unit level with atLeast", () => {
    const expr = unitLevel(12, 2000, 'atLeast', 'COMP');
    const result = describeExpression(expr);
    expect(result).toBe("12 units of COMP 2000+-level courses");
  });

  test("describeExpression() - unit level with exact", () => {
    const expr = unitLevel(18, 3000, 'exact');
    const result = describeExpression(expr);
    expect(result).toBe("18 units of 3000-level courses");
  });

  test("describeExpression() - unit level with atMost", () => {
    const expr = unitLevel(6, 1000, 'atMost', 'MATH');
    const result = describeExpression(expr);
    expect(result).toBe("6 units of MATH 1000--level courses");
  });

  test("describeExpression() - empty AND returns 'None'", () => {
    const expr = and();
    const result = describeExpression(expr);
    expect(result).toBe("None");
  });

  test("describeExpression() - single operand AND returns operand description", () => {
    const expr = and(courseReq("COMP1100"));
    const result = describeExpression(expr);
    expect(result).toBe("COMP1100");
  });
});
