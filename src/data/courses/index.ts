import { Course } from "../../types";
import { COMP_COURSES } from "./COMP";
import { ENGN_COURSES } from "./ENGN";
import { MATH_COURSES } from "./MATH";
import { PHYS_COURSES } from "./PHYS";

// Registry of all course modules for dynamic access
export const courseModules = {
  COMP: COMP_COURSES,
  ENGN: ENGN_COURSES,
  MATH: MATH_COURSES,
  PHYS: PHYS_COURSES,
} as const;

// Combined courses object
export const courses: Record<string, Course> = {
  ...COMP_COURSES,
  ...ENGN_COURSES,
  ...MATH_COURSES,
  ...PHYS_COURSES,
};

// Re-export individual modules for direct access
export { COMP_COURSES } from "./COMP";
export { ENGN_COURSES } from "./ENGN";
export { MATH_COURSES } from "./MATH";
export { PHYS_COURSES } from "./PHYS";

// Helper exports
export const courseList = Object.values(courses);

export const getCoursesByType = (type: Course["type"]): Course[] => {
  return courseList.filter((c) => c.type === type);
};

export const getCoursesByLevel = (level: number): Course[] => {
  return courseList.filter((c) => c.level === level);
};

export const getCourseBySemester = (semester: "S1" | "S2"): Course[] => {
  return courseList.filter((c) => c.semesters.includes(semester));
};

export const getCoursesByPrefix = (prefix: string): Course[] => {
  return courseList.filter((c) => c.code.startsWith(prefix));
};

// Get list of all available course prefixes
export const getCoursePrefixes = (): string[] => {
  return Object.keys(courseModules);
};
