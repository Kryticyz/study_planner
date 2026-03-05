import { expect, test, describe } from "bun:test";
import {
  courses,
  courseList,
  courseModules,
  getCoursePrefixes,
  getCoursesByPrefix,
  COMP_COURSES,
  ENGN_COURSES,
  MATH_COURSES,
  PHYS_COURSES,
} from "../src/data/courses";

describe("Course Imports", () => {
  test("all course modules are imported", () => {
    const prefixes = getCoursePrefixes();
    expect(prefixes).toContain("COMP");
    expect(prefixes).toContain("ENGN");
    expect(prefixes).toContain("MATH");
    expect(prefixes).toContain("PHYS");
    expect(prefixes.length).toBe(4);
  });

  test("COMP courses are imported", () => {
    expect(Object.keys(COMP_COURSES).length).toBeGreaterThan(0);
    expect(COMP_COURSES.COMP1100).toBeDefined();
    expect(COMP_COURSES.COMP1100.code).toBe("COMP1100");
  });

  test("ENGN courses are imported", () => {
    expect(Object.keys(ENGN_COURSES).length).toBeGreaterThan(0);
    expect(ENGN_COURSES.ENGN1211).toBeDefined();
    expect(ENGN_COURSES.ENGN1211.code).toBe("ENGN1211");
  });

  test("MATH courses are imported", () => {
    expect(Object.keys(MATH_COURSES).length).toBeGreaterThan(0);
    expect(MATH_COURSES.MATH1013).toBeDefined();
    expect(MATH_COURSES.MATH1013.code).toBe("MATH1013");
  });

  test("PHYS courses are imported", () => {
    expect(Object.keys(PHYS_COURSES).length).toBeGreaterThan(0);
    expect(PHYS_COURSES.PHYS1101).toBeDefined();
    expect(PHYS_COURSES.PHYS1101.code).toBe("PHYS1101");
  });

  test("combined courses object contains all courses", () => {
    const totalIndividual =
      Object.keys(COMP_COURSES).length +
      Object.keys(ENGN_COURSES).length +
      Object.keys(MATH_COURSES).length +
      Object.keys(PHYS_COURSES).length;

    expect(Object.keys(courses).length).toBe(totalIndividual);
  });

  test("courseList is populated correctly", () => {
    expect(courseList.length).toBe(Object.keys(courses).length);
    expect(courseList.length).toBeGreaterThan(0);
  });

  test("courseModules registry contains all modules", () => {
    expect(courseModules.COMP).toBe(COMP_COURSES);
    expect(courseModules.ENGN).toBe(ENGN_COURSES);
    expect(courseModules.MATH).toBe(MATH_COURSES);
    expect(courseModules.PHYS).toBe(PHYS_COURSES);
  });

  test("getCoursesByPrefix returns correct courses", () => {
    const compCourses = getCoursesByPrefix("COMP");
    expect(compCourses.length).toBe(Object.keys(COMP_COURSES).length);
    expect(compCourses.every((c) => c.code.startsWith("COMP"))).toBe(true);

    const engnCourses = getCoursesByPrefix("ENGN");
    expect(engnCourses.length).toBe(Object.keys(ENGN_COURSES).length);
    expect(engnCourses.every((c) => c.code.startsWith("ENGN"))).toBe(true);
  });

  test("all courses have required fields", () => {
    for (const course of courseList) {
      expect(course.code).toBeDefined();
      expect(course.name).toBeDefined();
      expect(course.units).toBeDefined();
      expect(course.level).toBeDefined();
      expect(course.college).toBeDefined();
      expect(course.semesters).toBeDefined();
      expect(course.description).toBeDefined();
    }
  });

  test("course codes match their keys in the combined object", () => {
    for (const [key, course] of Object.entries(courses)) {
      expect(course.code).toBe(key);
    }
  });

  test("no duplicate courses exist between modules", () => {
    const allCodes = [
      ...Object.keys(COMP_COURSES),
      ...Object.keys(ENGN_COURSES),
      ...Object.keys(MATH_COURSES),
      ...Object.keys(PHYS_COURSES),
    ];
    const uniqueCodes = new Set(allCodes);
    expect(allCodes.length).toBe(uniqueCodes.size);
  });
});

describe("Course Data Integrity", () => {
  test("course levels are valid", () => {
    const validLevels = [1000, 2000, 3000, 4000];
    for (const course of courseList) {
      expect(validLevels).toContain(course.level);
    }
  });

  test("course units are reasonable", () => {
    for (const course of courseList) {
      expect(course.units).toBeGreaterThanOrEqual(0);
      expect(course.units).toBeLessThanOrEqual(24);
    }
  });

  test("course semesters are valid", () => {
    const validSemesters = ["S1", "S2", "Summer", "Full Year"];
    for (const course of courseList) {
      for (const semester of course.semesters) {
        expect(validSemesters).toContain(semester);
      }
    }
  });
});
