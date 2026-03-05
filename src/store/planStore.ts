import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StudyPlan, PlannedCourse, ValidationError, CombinedDegreeProgress, DegreeComponentProgress, RequirementProgress } from '../types';
import { courses } from '../data/courses';
import { degreeRequirements, electronicsCommunicationsMajor } from '../data/requirements';
import { getEquivalenceRegistry } from '../data/equivalences';
import { evaluateExpression, describeExpression } from '../utils/prerequisiteEvaluator';
import { validateCorequisites } from '../utils/corequisiteValidator';
import { EvaluationContext } from '../types/prerequisites';
import { getProgram, getDegree, getMaxYear, getDefaultDegreeAttribution, canUseAsElective } from '../data/degreeRegistry';

interface PlanStore {
  plans: StudyPlan[];
  activePlanId: string | null;
  comparisonPlanIds: string[];
  isCompareMode: boolean;

  // Actions
  createPlan: (name: string, startYear?: number, startSemester?: 1 | 2, program?: string) => string;
  deletePlan: (id: string) => void;
  duplicatePlan: (id: string) => string;
  renamePlan: (id: string, name: string) => void;
  setActivePlan: (id: string) => void;

  // Course management
  addCourse: (planId: string, courseCode: string, year: number, semester: 1 | 2) => void;
  removeCourse: (planId: string, courseCode: string) => void;
  moveCourse: (planId: string, courseCode: string, year: number, semester: 1 | 2) => void;
  markCompleted: (planId: string, courseCode: string) => void;
  unmarkCompleted: (planId: string, courseCode: string) => void;
  setCourseCountingOverride: (planId: string, courseCode: string, degrees: string[]) => void;

  // Comparison mode
  toggleCompareMode: () => void;
  setComparisonPlans: (planIds: string[]) => void;

  // Getters
  getActivePlan: () => StudyPlan | null;
  getPlanById: (id: string) => StudyPlan | undefined;
  getCoursesForSemester: (planId: string, year: number, semester: 1 | 2) => PlannedCourse[];
  validatePlan: (planId: string) => ValidationError[];
  getPrerequisitesMet: (planId: string, courseCode: string, year: number, semester: 1 | 2) => boolean;
  getSemesterUnits: (planId: string, year: number, semester: 1 | 2) => number;
  getMaxYearForPlan: (planId: string) => number;
  getDegreeProgress: (planId: string) => {
    foundations: { required: number; completed: number; courses: string[] };
    engineeringFundamentals: { required: number; completed: number; courses: string[] };
    professionalCore: { required: number; completed: number; courses: string[] };
    major: { required: number; completed: number; courses: string[] };
    capstone: { required: number; completed: number; courses: string[] };
    engnElectives: { required: number; completed: number; courses: string[] };
    universityElectives: { required: number; completed: number; courses: string[] };
    total: { required: number; completed: number };
  };
  getCombinedDegreeProgress: (planId: string) => CombinedDegreeProgress | null;
}

const generateId = () => Math.random().toString(36).substring(2, 15);

// Helper to get chronological position of a semester slot
// Returns a number that can be compared to determine which slot comes first
const getChronologicalPosition = (year: number, semester: 1 | 2, startSemester: 1 | 2): number => {
  // Each year has 2 semesters, so base position is (year - 1) * 2
  // When starting S1: S1 is first (add 1), S2 is second (add 2)
  // When starting S2: S2 is first (add 1), S1 is second (add 2)
  const semesterOffset = startSemester === 1
    ? semester  // S1=1, S2=2
    : (semester === 2 ? 1 : 2);  // S2=1, S1=2
  return (year - 1) * 2 + semesterOffset;
};

// Helper to get the next semester slot chronologically
const getNextSemester = (year: number, semester: 1 | 2, startSemester: 1 | 2, maxYear: number = 4): { year: number; semester: 1 | 2 } | null => {
  if (startSemester === 1) {
    // S1 -> S2 (same year), S2 -> S1 (next year)
    if (semester === 1) return { year, semester: 2 };
    if (year >= maxYear) return null; // Can't go beyond max year
    return { year: year + 1, semester: 1 };
  } else {
    // S2 -> S1 (next year), S1 -> S2 (same year)
    if (semester === 2) {
      if (year >= maxYear) return null; // Can't go beyond max year
      return { year: year + 1, semester: 1 };
    }
    return { year, semester: 2 };
  }
};

// Helper to get all semester slots a course occupies (including span)
const getOccupiedSlots = (
  year: number,
  semester: 1 | 2,
  semesterSpan: number,
  startSemester: 1 | 2,
  maxYear: number = 4
): { year: number; semester: 1 | 2 }[] => {
  const slots: { year: number; semester: 1 | 2 }[] = [{ year, semester }];
  let current = { year, semester };

  for (let i = 1; i < semesterSpan; i++) {
    const next = getNextSemester(current.year, current.semester, startSemester, maxYear);
    if (!next) break; // Can't extend beyond max year
    slots.push(next);
    current = next;
  }

  return slots;
};

export const usePlanStore = create<PlanStore>()(
  persist(
    (set, get) => ({
      plans: [],
      activePlanId: null,
      comparisonPlanIds: [],
      isCompareMode: false,

      createPlan: (name: string, startYear = 2025, startSemester: 1 | 2 = 1, program: string = 'AENGI') => {
        const id = generateId();
        const newPlan: StudyPlan = {
          id,
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          startYear,
          startSemester,
          program,
          courses: [],
          completedCourses: [],
        };
        set(state => ({
          plans: [...state.plans, newPlan],
          activePlanId: state.activePlanId || id,
        }));
        return id;
      },

      deletePlan: (id: string) => {
        set(state => {
          const newPlans = state.plans.filter(p => p.id !== id);
          let newActivePlanId = state.activePlanId;
          if (state.activePlanId === id) {
            newActivePlanId = newPlans.length > 0 ? newPlans[0].id : null;
          }
          return {
            plans: newPlans,
            activePlanId: newActivePlanId,
            comparisonPlanIds: state.comparisonPlanIds.filter(pid => pid !== id),
          };
        });
      },

      duplicatePlan: (id: string) => {
        const plan = get().plans.find(p => p.id === id);
        if (!plan) return '';
        const newId = generateId();
        const newPlan: StudyPlan = {
          ...plan,
          id: newId,
          name: `${plan.name} (Copy)`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          startSemester: plan.startSemester ?? 1,
          program: plan.program ?? 'AENGI',
          courses: [...plan.courses],
          completedCourses: [...plan.completedCourses],
        };
        set(state => ({
          plans: [...state.plans, newPlan],
        }));
        return newId;
      },

      renamePlan: (id: string, name: string) => {
        set(state => ({
          plans: state.plans.map(p =>
            p.id === id ? { ...p, name, updatedAt: Date.now() } : p
          ),
        }));
      },

      setActivePlan: (id: string) => {
        set({ activePlanId: id });
      },

      addCourse: (planId: string, courseCode: string, year: number, semester: 1 | 2) => {
        const course = courses[courseCode];
        const semesterSpan = course?.semesterSpan ?? 1;

        set(state => ({
          plans: state.plans.map(p => {
            if (p.id !== planId) return p;
            const exists = p.courses.some(c => c.courseCode === courseCode);
            if (exists) return p;

            const startSemester = p.startSemester ?? 1;
            const maxYear = getMaxYear(p.program ?? 'AENGI');

            // Check year is within valid range for this degree
            if (year > maxYear) return p;

            // For multi-semester courses, check that all slots are available
            if (semesterSpan > 1) {
              const occupiedSlots = getOccupiedSlots(year, semester, semesterSpan, startSemester, maxYear);

              // Check course doesn't extend beyond max year
              if (occupiedSlots.length < semesterSpan) return p;

              // Check no conflicts with existing courses in any occupied slot
              for (const slot of occupiedSlots) {
                const hasConflict = p.courses.some(existingCourse => {
                  const existingCourseData = courses[existingCourse.courseCode];
                  const existingSpan = existingCourseData?.semesterSpan ?? 1;
                  const existingOccupied = getOccupiedSlots(
                    existingCourse.year, existingCourse.semester, existingSpan, startSemester, maxYear
                  );
                  return existingOccupied.some(s => s.year === slot.year && s.semester === slot.semester);
                });
                if (hasConflict) return p;
              }
            }

            return {
              ...p,
              courses: [...p.courses, { courseCode, year, semester }],
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      removeCourse: (planId: string, courseCode: string) => {
        set(state => ({
          plans: state.plans.map(p => {
            if (p.id !== planId) return p;
            return {
              ...p,
              courses: p.courses.filter(c => c.courseCode !== courseCode),
              completedCourses: p.completedCourses.filter(c => c !== courseCode),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      moveCourse: (planId: string, courseCode: string, year: number, semester: 1 | 2) => {
        const course = courses[courseCode];
        const semesterSpan = course?.semesterSpan ?? 1;

        set(state => ({
          plans: state.plans.map(p => {
            if (p.id !== planId) return p;

            const startSemester = p.startSemester ?? 1;
            const maxYear = getMaxYear(p.program ?? 'AENGI');

            // Check year is within valid range for this degree
            if (year > maxYear) return p;

            // For multi-semester courses, check that all slots are available
            if (semesterSpan > 1) {
              const occupiedSlots = getOccupiedSlots(year, semester, semesterSpan, startSemester, maxYear);

              // Check course doesn't extend beyond max year
              if (occupiedSlots.length < semesterSpan) return p;

              // Check no conflicts with OTHER existing courses in any occupied slot
              for (const slot of occupiedSlots) {
                const hasConflict = p.courses.some(existingCourse => {
                  // Skip the course being moved
                  if (existingCourse.courseCode === courseCode) return false;
                  const existingCourseData = courses[existingCourse.courseCode];
                  const existingSpan = existingCourseData?.semesterSpan ?? 1;
                  const existingOccupied = getOccupiedSlots(
                    existingCourse.year, existingCourse.semester, existingSpan, startSemester, maxYear
                  );
                  return existingOccupied.some(s => s.year === slot.year && s.semester === slot.semester);
                });
                if (hasConflict) return p;
              }
            }

            return {
              ...p,
              courses: p.courses.map(c =>
                c.courseCode === courseCode ? { ...c, year, semester } : c
              ),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      markCompleted: (planId: string, courseCode: string) => {
        set(state => ({
          plans: state.plans.map(p => {
            if (p.id !== planId) return p;
            if (p.completedCourses.includes(courseCode)) return p;
            return {
              ...p,
              completedCourses: [...p.completedCourses, courseCode],
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      unmarkCompleted: (planId: string, courseCode: string) => {
        set(state => ({
          plans: state.plans.map(p => {
            if (p.id !== planId) return p;
            return {
              ...p,
              completedCourses: p.completedCourses.filter(c => c !== courseCode),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      setCourseCountingOverride: (planId: string, courseCode: string, degrees: string[]) => {
        set(state => ({
          plans: state.plans.map(p => {
            if (p.id !== planId) return p;
            return {
              ...p,
              courses: p.courses.map(c =>
                c.courseCode === courseCode
                  ? { ...c, countTowardDegree: degrees.length > 0 ? degrees : undefined }
                  : c
              ),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      toggleCompareMode: () => {
        set(state => ({ isCompareMode: !state.isCompareMode }));
      },

      setComparisonPlans: (planIds: string[]) => {
        set({ comparisonPlanIds: planIds.slice(0, 3) });
      },

      getActivePlan: () => {
        const state = get();
        return state.plans.find(p => p.id === state.activePlanId) || null;
      },

      getPlanById: (id: string) => {
        return get().plans.find(p => p.id === id);
      },

      getCoursesForSemester: (planId: string, year: number, semester: 1 | 2) => {
        const plan = get().plans.find(p => p.id === planId);
        if (!plan) return [];

        const startSemester = plan.startSemester ?? 1;
        const maxYear = getMaxYear(plan.program ?? 'AENGI');

        // Return courses that occupy this slot (either start here or span into here)
        return plan.courses.filter(c => {
          const course = courses[c.courseCode];
          const semesterSpan = course?.semesterSpan ?? 1;

          if (semesterSpan === 1) {
            // Single semester course - must start here
            return c.year === year && c.semester === semester;
          }

          // Multi-semester course - check if any of its occupied slots match
          const occupiedSlots = getOccupiedSlots(c.year, c.semester, semesterSpan, startSemester, maxYear);
          return occupiedSlots.some(slot => slot.year === year && slot.semester === semester);
        });
      },

      getPrerequisitesMet: (planId: string, courseCode: string, year: number, semester: 1 | 2) => {
        const plan = get().plans.find(p => p.id === planId);
        if (!plan) return false;

        const course = courses[courseCode];
        if (!course) return false;

        const expression = course.prerequisiteExpression ?? null;
        if (!expression) return true; // No prerequisites

        const startSemester = plan.startSemester ?? 1;
        const targetPosition = getChronologicalPosition(year, semester, startSemester); // normalise for start sem

        // Get prior courses with full data for unit calculations
        const priorCourseCodes = plan.courses
          .filter(c => getChronologicalPosition(c.year, c.semester, startSemester) < targetPosition)
          .map(c => c.courseCode);

        // Get courses in the same semester (for concurrentAllowed)
        const concurrentCourseCodes = plan.courses
          .filter(c => getChronologicalPosition(c.year, c.semester, startSemester) === targetPosition && c.courseCode !== courseCode)
          .map(c => c.courseCode);

        const completedSet = new Set([...priorCourseCodes, ...plan.completedCourses]);
        const completedCoursesData = [...completedSet]
          .map(code => courses[code])
          .filter(Boolean)
          .map(c => ({ code: c.code, units: c.units, level: c.level }));

        const context: EvaluationContext = {
          completedCourses: completedSet,
          completedCoursesData,
          equivalenceRegistry: getEquivalenceRegistry(),
          concurrentCourses: new Set(concurrentCourseCodes),
        };

        const result = evaluateExpression(expression, context);
        return result.satisfied;
      },

      getSemesterUnits: (planId: string, year: number, semester: 1 | 2) => {
        const semesterCourses = get().getCoursesForSemester(planId, year, semester);
        return semesterCourses.reduce((total, c) => {
          const course = courses[c.courseCode];
          if (!course) return total;
          // Split units across semesters for multi-semester courses
          const semesterSpan = course.semesterSpan ?? 1;
          return total + (course.units / semesterSpan);
        }, 0);
      },

      getMaxYearForPlan: (planId: string) => {
        const plan = get().plans.find(p => p.id === planId);
        return getMaxYear(plan?.program ?? 'AENGI');
      },

      validatePlan: (planId: string) => {
        const plan = get().plans.find(p => p.id === planId);
        if (!plan) return [];

        const errors: ValidationError[] = [];
        const maxYear = getMaxYear(plan.program ?? 'AENGI');

        plan.courses.forEach(pc => {
          const course = courses[pc.courseCode];
          if (!course) return;

          // Check prerequisites
          if (!get().getPrerequisitesMet(planId, pc.courseCode, pc.year, pc.semester)) {
            const expression = course.prerequisiteExpression;
            const prereqDescription = expression
              ? describeExpression(expression)
              : 'unknown prerequisites';
            errors.push({
              courseCode: pc.courseCode,
              type: 'prerequisite',
              message: `Prerequisites not met: ${prereqDescription}`,
            });
          }

          // Check corequisites
          const coreqErrors = validateCorequisites(
            pc.courseCode,
            course,
            pc.year,
            pc.semester,
            plan
          );
          errors.push(...coreqErrors);

          // Check semester availability
          const semesterStr = pc.semester === 1 ? 'S1' : 'S2';
          if (!course.semesters.includes(semesterStr) && !course.semesters.includes('Full Year')) {
            errors.push({
              courseCode: pc.courseCode,
              type: 'semester',
              message: `${course.code} is not offered in Semester ${pc.semester}`,
            });
          }

          // Check biennial courses
          const actualYear = plan.startYear + pc.year - 1;
          if (course.semesterPattern === 'odd_years_only' && actualYear % 2 === 0) {
            errors.push({
              courseCode: pc.courseCode,
              type: 'year',
              message: `${course.code} is only offered in odd years (2025, 2027, 2029)`,
            });
          }
          if (course.semesterPattern === 'even_years_only' && actualYear % 2 === 1) {
            errors.push({
              courseCode: pc.courseCode,
              type: 'year',
              message: `${course.code} is only offered in even years (2026, 2028, 2030)`,
            });
          }

          // Check incompatibilities
          if (course.incompatible) {
            const plannedCodes = plan.courses.map(c => c.courseCode);
            course.incompatible.forEach(incomp => {
              if (plannedCodes.includes(incomp)) {
                errors.push({
                  courseCode: pc.courseCode,
                  type: 'incompatible',
                  message: `Incompatible with ${incomp}`,
                });
              }
            });
          }

          // Check multi-semester course validity
          const semesterSpan = course.semesterSpan ?? 1;
          if (semesterSpan > 1) {
            const startSemester = plan.startSemester ?? 1;
            const occupiedSlots = getOccupiedSlots(pc.year, pc.semester, semesterSpan, startSemester, maxYear);

            // Check course doesn't extend beyond max year for this degree
            if (occupiedSlots.length < semesterSpan) {
              errors.push({
                courseCode: pc.courseCode,
                type: 'semester',
                message: `${course.code} extends beyond Year ${maxYear}`,
              });
            }

            // Check for overlaps with other multi-semester courses
            plan.courses.forEach(otherPc => {
              if (otherPc.courseCode === pc.courseCode) return;
              const otherCourse = courses[otherPc.courseCode];
              if (!otherCourse) return;
              const otherSpan = otherCourse.semesterSpan ?? 1;
              const otherOccupied = getOccupiedSlots(otherPc.year, otherPc.semester, otherSpan, startSemester, maxYear);

              for (const slot of occupiedSlots) {
                if (otherOccupied.some(s => s.year === slot.year && s.semester === slot.semester)) {
                  errors.push({
                    courseCode: pc.courseCode,
                    type: 'incompatible',
                    message: `${course.code} overlaps with ${otherCourse.code} in Year ${slot.year} S${slot.semester}`,
                  });
                  break;
                }
              }
            });
          }
        });

        // Check semester overload (check all years for this degree)
        for (let year = 1; year <= maxYear; year++) {
          for (const semester of [1, 2] as const) {
            const units = get().getSemesterUnits(planId, year, semester);
            if (units > 24) {
              errors.push({
                courseCode: '',
                type: 'overload',
                message: `Year ${year} Semester ${semester}: ${units} units exceeds 24 unit limit`,
              });
            }
          }
        }

        return errors;
      },

      getDegreeProgress: (planId: string) => {
        const plan = get().plans.find(p => p.id === planId);
        const reqs = degreeRequirements.singleDegree.requirements;
        const major = electronicsCommunicationsMajor;

        const empty = {
          foundations: { required: 36, completed: 0, courses: [] as string[] },
          engineeringFundamentals: { required: 36, completed: 0, courses: [] as string[] },
          professionalCore: { required: 24, completed: 0, courses: [] as string[] },
          major: { required: 48, completed: 0, courses: [] as string[] },
          capstone: { required: 12, completed: 0, courses: [] as string[] },
          engnElectives: { required: 24, completed: 0, courses: [] as string[] },
          universityElectives: { required: 24, completed: 0, courses: [] as string[] },
          total: { required: 192, completed: 0 },
        };

        if (!plan) return empty;

        const plannedCodes = new Set(plan.courses.map(c => c.courseCode));
        const usedForCategory = new Set<string>();

        // Foundations
        const foundationCourses = reqs.foundations.courses.filter(c => plannedCodes.has(c));
        foundationCourses.forEach(c => usedForCategory.add(c));
        const foundationUnits = foundationCourses.reduce((sum, c) => sum + (courses[c]?.units || 0), 0);

        // Engineering Fundamentals
        const engFundCourses = reqs.engineeringFundamentals.courses.filter(c => plannedCodes.has(c));
        engFundCourses.forEach(c => usedForCategory.add(c));
        const engFundUnits = engFundCourses.reduce((sum, c) => sum + (courses[c]?.units || 0), 0);

        // Professional Core
        const profCoreCourses = reqs.professionalCore.courses.filter(c => plannedCodes.has(c));
        profCoreCourses.forEach(c => usedForCategory.add(c));
        const profCoreUnits = profCoreCourses.reduce((sum, c) => sum + (courses[c]?.units || 0), 0);

        // Major (Electronic and Communications Systems)
        const majorCodes = major.requiredCourses.map(c => c.code);
        const majorActual: string[] = [];
        majorCodes.forEach(code => {
          if (plannedCodes.has(code)) {
            majorActual.push(code);
          } else {
            const alt = major.alternativeCourses[code];
            if (alt && plannedCodes.has(alt)) {
              majorActual.push(alt);
            }
          }
        });
        majorActual.forEach(c => usedForCategory.add(c));
        const majorUnits = majorActual.reduce((sum, c) => sum + (courses[c]?.units || 0), 0);

        // Capstone
        const capstoneCourses = reqs.capstone.courses.filter(c => plannedCodes.has(c));
        capstoneCourses.forEach(c => usedForCategory.add(c));
        const capstoneUnits = capstoneCourses.reduce((sum, c) => sum + (courses[c]?.units || 0), 0);

        // Electives (remaining ENGN courses and others)
        const remainingEngn: string[] = [];
        const remainingOther: string[] = [];
        plan.courses.forEach(pc => {
          if (usedForCategory.has(pc.courseCode)) return;
          const course = courses[pc.courseCode];
          if (!course) return;
          if (course.code.startsWith('ENGN')) {
            remainingEngn.push(pc.courseCode);
          } else {
            remainingOther.push(pc.courseCode);
          }
        });

        const engnElectiveUnits = remainingEngn.reduce((sum, c) => sum + (courses[c]?.units || 0), 0);
        const uniElectiveUnits = remainingOther.reduce((sum, c) => sum + (courses[c]?.units || 0), 0);

        const totalCompleted = foundationUnits + engFundUnits + profCoreUnits + majorUnits + capstoneUnits + engnElectiveUnits + uniElectiveUnits;

        return {
          foundations: { required: 36, completed: foundationUnits, courses: foundationCourses },
          engineeringFundamentals: { required: 36, completed: engFundUnits, courses: engFundCourses },
          professionalCore: { required: 24, completed: profCoreUnits, courses: profCoreCourses },
          major: { required: 48, completed: majorUnits, courses: majorActual },
          capstone: { required: 12, completed: capstoneUnits, courses: capstoneCourses },
          engnElectives: { required: 24, completed: Math.min(24, engnElectiveUnits), courses: remainingEngn },
          universityElectives: { required: 24, completed: Math.min(24, uniElectiveUnits), courses: remainingOther },
          total: { required: 192, completed: totalCompleted },
        };
      },

      getCombinedDegreeProgress: (planId: string): CombinedDegreeProgress | null => {
        const plan = get().plans.find(p => p.id === planId);
        if (!plan) return null;

        const programCode = plan.program ?? 'AENGI';
        const program = getProgram(programCode);
        if (!program) return null;

        const plannedCourses = plan.courses;
        const plannedCodes = new Set(plannedCourses.map(c => c.courseCode));

        // Helper to calculate progress for a single degree component
        const calculateDegreeProgress = (degreeCode: string, usedByOther: Set<string>): DegreeComponentProgress => {
          const degree = getDegree(degreeCode);
          if (!degree) {
            return {
              name: degreeCode,
              code: degreeCode,
              requirements: {},
              total: { required: 0, completed: 0 },
            };
          }

          const requirements: Record<string, RequirementProgress> = {};
          const usedInThisDegree = new Set<string>();
          let totalRequired = 0;
          let totalCompleted = 0;

          for (const [key, category] of Object.entries(degree.requirements)) {
            const completedCourses: string[] = [];
            let completedUnits = 0;

            if (category.courses) {
              for (const courseSpec of category.courses) {
                if (Array.isArray(courseSpec)) {
                  // Choice group - find one that's planned
                  const found = courseSpec.find(code =>
                    plannedCodes.has(code) && !usedByOther.has(code) && !usedInThisDegree.has(code)
                  );
                  if (found) {
                    completedCourses.push(found);
                    usedInThisDegree.add(found);
                    completedUnits += courses[found]?.units ?? 0;
                  }
                } else {
                  // Single required course
                  if (plannedCodes.has(courseSpec) && !usedByOther.has(courseSpec) && !usedInThisDegree.has(courseSpec)) {
                    completedCourses.push(courseSpec);
                    usedInThisDegree.add(courseSpec);
                    completedUnits += courses[courseSpec]?.units ?? 0;
                  }
                }
              }
            }

            // Handle prefix requirements (e.g., ENGN electives)
            if (category.prefixRequirements) {
              for (const prefixReq of category.prefixRequirements) {
                let prefixUnits = 0;
                for (const pc of plannedCourses) {
                  if (usedByOther.has(pc.courseCode) || usedInThisDegree.has(pc.courseCode)) continue;
                  const course = courses[pc.courseCode];
                  if (course && course.code.startsWith(prefixReq.prefix)) {
                    completedCourses.push(pc.courseCode);
                    usedInThisDegree.add(pc.courseCode);
                    prefixUnits += course.units;
                    if (prefixUnits >= prefixReq.minUnits) break;
                  }
                }
                completedUnits += Math.min(prefixUnits, prefixReq.minUnits);
              }
            }

            // Handle elective categories (remaining courses)
            if (!category.courses && !category.prefixRequirements && category.units > 0) {
              // This is a general elective category - fill with remaining courses
              for (const pc of plannedCourses) {
                if (completedUnits >= category.units) break;
                if (usedByOther.has(pc.courseCode) || usedInThisDegree.has(pc.courseCode)) continue;

                // For double degrees, check if this course can be used as elective for this degree
                if (program.isDoubleDegree && !canUseAsElective(pc.courseCode, degreeCode, programCode)) {
                  continue;
                }

                const course = courses[pc.courseCode];
                if (course) {
                  completedCourses.push(pc.courseCode);
                  usedInThisDegree.add(pc.courseCode);
                  completedUnits += course.units;
                }
              }
            }

            requirements[key] = {
              name: category.name,
              description: category.description,
              required: category.units,
              completed: Math.min(completedUnits, category.units),
              courses: category.courses?.flat() ?? [],
              completedCourses,
            };

            totalRequired += category.units;
            totalCompleted += Math.min(completedUnits, category.units);
          }

          return {
            name: degree.name,
            code: degree.code,
            requirements,
            total: { required: totalRequired, completed: totalCompleted },
          };
        };

        // For single degrees
        if (!program.isDoubleDegree) {
          const primary = calculateDegreeProgress(program.degreeComponents[0], new Set());
          return {
            programCode,
            programName: program.name,
            isDoubleDegree: false,
            primary,
            overallTotal: primary.total,
          };
        }

        // For double degrees
        // First, identify shared mandatory courses that count for both
        const sharedCourses = new Set<string>();
        for (const pc of plannedCourses) {
          const attribution = getDefaultDegreeAttribution(pc.courseCode, programCode, pc.countTowardDegree);
          if (attribution.length > 1) {
            sharedCourses.add(pc.courseCode);
          }
        }

        // Calculate primary degree progress
        const primary = calculateDegreeProgress(program.degreeComponents[0], new Set());

        // For secondary, exclude courses used exclusively by primary (but allow shared)
        const usedByPrimary = new Set<string>();
        for (const reqs of Object.values(primary.requirements)) {
          for (const code of reqs.completedCourses) {
            if (!sharedCourses.has(code)) {
              usedByPrimary.add(code);
            }
          }
        }

        const secondary = calculateDegreeProgress(program.degreeComponents[1], usedByPrimary);

        // Calculate overall total (shared courses count once for overall)
        const allUsedCourses = new Set<string>();
        for (const reqs of Object.values(primary.requirements)) {
          reqs.completedCourses.forEach(c => allUsedCourses.add(c));
        }
        for (const reqs of Object.values(secondary.requirements)) {
          reqs.completedCourses.forEach(c => allUsedCourses.add(c));
        }
        const overallCompleted = [...allUsedCourses].reduce((sum, code) => sum + (courses[code]?.units ?? 0), 0);

        return {
          programCode,
          programName: program.name,
          isDoubleDegree: true,
          primary,
          secondary,
          overallTotal: { required: program.totalUnits, completed: overallCompleted },
        };
      },
    }),
    {
      name: 'anu-study-planner-storage',
    }
  )
);
