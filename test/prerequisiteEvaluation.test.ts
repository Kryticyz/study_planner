import { test, expect, describe } from "bun:test";
import { evaluateExpression, courseReq, and, or, unitLevel } from "../src/utils/prerequisiteEvaluator";
import { createContext, createContextWithUnits, createEmptyContext, expectSatisfied, expectNotSatisfied } from "./testHelpers";

describe("CourseRequirement Evaluation", () => {
  test("Direct course match is satisfied", () => {
    const expr = courseReq("COMP1100");
    const context = createContext(["COMP1100"]);
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("Missing course is not satisfied", () => {
    const expr = courseReq("COMP1100");
    const context = createEmptyContext();
    const result = evaluateExpression(expr, context);
    expect(result.satisfied).toBe(false);
    expect(result.reason).toBe("Missing: COMP1100");
    expect(result.details?.missingCourses).toEqual(["COMP1100"]);
  });

  test("Equivalent course satisfied (COMP1100/COMP1130)", () => {
    const expr = courseReq("COMP1100");
    const context = createContext(["COMP1130"]); // COMP1130 is equivalent to COMP1100
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("Equivalent course reverse (COMP1130/COMP1100)", () => {
    const expr = courseReq("COMP1130");
    const context = createContext(["COMP1100"]); // COMP1100 is equivalent to COMP1130
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("Math equivalence (MATH1013/MATH1115)", () => {
    const expr = courseReq("MATH1013");
    const context = createContext(["MATH1115"]); // MATH1115 is equivalent to MATH1013
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("Non-equivalent course is not satisfied", () => {
    const expr = courseReq("COMP1100");
    const context = createContext(["COMP2100"]); // Different course, not equivalent
    const result = evaluateExpression(expr, context);
    expectNotSatisfied(result, ["COMP1100"]);
  });
});

describe("AndExpression Evaluation", () => {
  test("All operands satisfied", () => {
    const expr = and(courseReq("COMP1100"), courseReq("COMP2100"));
    const context = createContext(["COMP1100", "COMP2100"]);
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("One operand missing", () => {
    const expr = and(courseReq("COMP1100"), courseReq("COMP2100"));
    const context = createContext(["COMP1100"]);
    const result = evaluateExpression(expr, context);
    expectNotSatisfied(result, ["COMP2100"]);
  });

  test("All operands missing", () => {
    const expr = and(courseReq("COMP1100"), courseReq("COMP2100"));
    const context = createEmptyContext();
    const result = evaluateExpression(expr, context);
    expect(result.satisfied).toBe(false);
    expect(result.details?.missingCourses).toContain("COMP1100");
    expect(result.details?.missingCourses).toContain("COMP2100");
  });

  test("Empty AND is satisfied (vacuous truth)", () => {
    const expr = and();
    const context = createEmptyContext();
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("Single operand AND delegates to operand", () => {
    const expr = and(courseReq("COMP1100"));
    const context = createContext(["COMP1100"]);
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });
});

describe("OrExpression Evaluation", () => {
  test("First option satisfied", () => {
    const expr = or(courseReq("COMP1100"), courseReq("COMP1130"));
    const context = createContext(["COMP1100"]);
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("Second option satisfied", () => {
    const expr = or(courseReq("COMP1100"), courseReq("COMP1130"));
    const context = createContext(["COMP1130"]);
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("Both options satisfied", () => {
    const expr = or(courseReq("COMP1100"), courseReq("COMP1130"));
    const context = createContext(["COMP1100", "COMP1130"]);
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("Neither option satisfied", () => {
    const expr = or(courseReq("COMP1100"), courseReq("COMP1130"));
    const context = createEmptyContext();
    const result = evaluateExpression(expr, context);
    expect(result.satisfied).toBe(false);
    expect(result.reason).toContain("One of the following required");
  });

  test("Empty OR is not satisfied", () => {
    const expr = or();
    const context = createEmptyContext();
    const result = evaluateExpression(expr, context);
    expectNotSatisfied(result);
  });
});

describe("UnitLevelRequirement Evaluation", () => {
  test("Exact level match - satisfied", () => {
    const expr = unitLevel(12, 2000, 'exact');
    const context = createContextWithUnits([
      { code: 'COMP2100', units: 6, level: 2000 },
      { code: 'COMP2310', units: 6, level: 2000 }
    ]);
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("Exact level match - insufficient units", () => {
    const expr = unitLevel(12, 2000, 'exact');
    const context = createContextWithUnits([
      { code: 'COMP2100', units: 6, level: 2000 }
    ]);
    const result = evaluateExpression(expr, context);
    expect(result.satisfied).toBe(false);
    expect(result.details?.missingUnits).toEqual({ level: 2000, required: 12, have: 6 });
  });

  test("AtLeast level - satisfied with exact level", () => {
    const expr = unitLevel(12, 2000, 'atLeast');
    const context = createContextWithUnits([
      { code: 'COMP2100', units: 6, level: 2000 },
      { code: 'COMP2310', units: 6, level: 2000 }
    ]);
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("AtLeast level - satisfied with higher level", () => {
    const expr = unitLevel(12, 2000, 'atLeast');
    const context = createContextWithUnits([
      { code: 'COMP3600', units: 6, level: 3000 },
      { code: 'COMP3620', units: 6, level: 3000 }
    ]);
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("AtLeast level - mix of levels", () => {
    const expr = unitLevel(12, 2000, 'atLeast');
    const context = createContextWithUnits([
      { code: 'COMP2100', units: 6, level: 2000 },
      { code: 'COMP3600', units: 6, level: 3000 }
    ]);
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("AtLeast level - lower level doesn't count", () => {
    const expr = unitLevel(12, 2000, 'atLeast');
    const context = createContextWithUnits([
      { code: 'COMP1100', units: 6, level: 1000 },
      { code: 'COMP1110', units: 6, level: 1000 }
    ]);
    const result = evaluateExpression(expr, context);
    expect(result.satisfied).toBe(false);
    expect(result.details?.missingUnits).toEqual({ level: 2000, required: 12, have: 0 });
  });

  test("With course prefix (COMP) - satisfied", () => {
    const expr = unitLevel(12, 2000, 'atLeast', 'COMP');
    const context = createContextWithUnits([
      { code: 'COMP2100', units: 6, level: 2000 },
      { code: 'COMP2310', units: 6, level: 2000 }
    ]);
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("With course prefix - wrong prefix doesn't count", () => {
    const expr = unitLevel(12, 2000, 'atLeast', 'COMP');
    const context = createContextWithUnits([
      { code: 'MATH2000', units: 6, level: 2000 },
      { code: 'ENGN2000', units: 6, level: 2000 }
    ]);
    const result = evaluateExpression(expr, context);
    expect(result.satisfied).toBe(false);
    expect(result.details?.missingUnits?.have).toBe(0);
  });

  test("With course prefix - mixed prefixes", () => {
    const expr = unitLevel(12, 2000, 'atLeast', 'COMP');
    const context = createContextWithUnits([
      { code: 'COMP2100', units: 6, level: 2000 },
      { code: 'MATH2000', units: 6, level: 2000 }
    ]);
    const result = evaluateExpression(expr, context);
    expect(result.satisfied).toBe(false);
    expect(result.details?.missingUnits).toEqual({ level: 2000, required: 12, have: 6 });
  });
});

describe("Complex Nested Expressions", () => {
  test("AND of ORs - all satisfied (COMP2310 pattern)", () => {
    // (COMP1110 OR COMP1140) AND (COMP2300 OR ENGN2219)
    const expr = and(
      or(courseReq("COMP1110"), courseReq("COMP1140")),
      or(courseReq("COMP2300"), courseReq("ENGN2219"))
    );
    const context = createContext(["COMP1110", "COMP2300"]);
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("AND of ORs - first OR not satisfied", () => {
    const expr = and(
      or(courseReq("COMP1110"), courseReq("COMP1140")),
      or(courseReq("COMP2300"), courseReq("ENGN2219"))
    );
    const context = createContext(["COMP2300"]); // Missing first OR requirement
    const result = evaluateExpression(expr, context);
    expectNotSatisfied(result);
  });

  test("AND of ORs - second OR not satisfied", () => {
    const expr = and(
      or(courseReq("COMP1110"), courseReq("COMP1140")),
      or(courseReq("COMP2300"), courseReq("ENGN2219"))
    );
    const context = createContext(["COMP1110"]); // Missing second OR requirement
    const result = evaluateExpression(expr, context);
    expectNotSatisfied(result);
  });

  test("AND of ORs - satisfied with alternatives", () => {
    const expr = and(
      or(courseReq("COMP1110"), courseReq("COMP1140")),
      or(courseReq("COMP2300"), courseReq("ENGN2219"))
    );
    const context = createContext(["COMP1140", "ENGN2219"]); // Alternative options
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("OR with equivalences - satisfied via equivalent", () => {
    const expr = or(courseReq("COMP1100"), courseReq("COMP1110"));
    const context = createContext(["COMP1130"]); // COMP1130 is equivalent to COMP1100
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("Mixed unit level and course requirements", () => {
    const expr = and(
      unitLevel(12, 2000, 'atLeast'),
      courseReq("COMP1100")
    );
    const context = createContextWithUnits([
      { code: 'COMP1100', units: 6, level: 1000 },
      { code: 'COMP2100', units: 6, level: 2000 },
      { code: 'COMP2310', units: 6, level: 2000 }
    ]);
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("Triple nesting - complex structure", () => {
    // OR(AND(course1, course2), AND(course3, course4))
    const expr = or(
      and(courseReq("COMP1100"), courseReq("COMP1110")),
      and(courseReq("COMP1130"), courseReq("COMP1140"))
    );
    // Satisfy the second AND branch
    const context = createContext(["COMP1130", "COMP1140"]);
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });

  test("Large OR groups (5+ options)", () => {
    const expr = or(
      courseReq("COMP3670"),
      courseReq("MATH1013"),
      courseReq("MATH1014"),
      courseReq("MATH1115"),
      courseReq("MATH1116")
    );
    // Satisfy with one of the middle options
    const context = createContext(["MATH1014"]);
    const result = evaluateExpression(expr, context);
    expectSatisfied(result);
  });
});
