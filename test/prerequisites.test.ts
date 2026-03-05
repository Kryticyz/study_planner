import { evaluateExpression, courseReq } from "../src/utils/prerequisiteEvaluator.ts"
import { expect, test, describe } from "bun:test";
import { createContext } from "./testHelpers.ts";

describe("Prerequisites Basic Tests", () => {
  test("simple math", () => {
    expect(2+2).toBe(4);
  });

  test("Single prerequisite evaluates correctly when satisfied", () => {
    const expr = courseReq("COMP1100");
    const context = createContext(["COMP1100"]);

    const result = evaluateExpression(expr, context);
    expect(result.satisfied).toBe(true);
  });

  test("Single prerequisite evaluates correctly when not satisfied", () => {
    const expr = courseReq("COMP1100");
    const context = createContext([]);

    const result = evaluateExpression(expr, context);
    expect(result.satisfied).toBe(false);
    expect(result.details?.missingCourses).toContain("COMP1100");
  });
});
