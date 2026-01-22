import {parsePreqStatement} from "../src/utils/prerequisiteEvaluator.ts"
import {expect, test} from "bun:test";

const none = []
const single = ["COMP1100"]
const double_and = ["COMP1100", "COMP1110"]
const double_or = [["COMP1100", "COMP1110"]]
const units = ["COMP-0-12"]
const complex = [["COMP1100", "COMP1110"], "COMP2100", "MATH-0-6"]

test("simple maff", () => {
  expect(2+2).toBe(4);
})

test("Single preq", () => {
  const course = {
    prerequisites: single
  }
  expect(parsePreqStatement(course)).toBe({type:'course', courseCode: 'COMP1100'})
})
