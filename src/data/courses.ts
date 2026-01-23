// Re-export everything from the new modular structure
// This maintains backwards compatibility with existing imports
export {
  courses,
  courseList,
  getCoursesByType,
  getCoursesByLevel,
  getCourseBySemester,
  getCoursesByPrefix,
  getCoursePrefixes,
  courseModules,
  COMP_COURSES,
  ENGN_COURSES,
  MATH_COURSES,
  PHYS_COURSES,
} from "./courses/index";
