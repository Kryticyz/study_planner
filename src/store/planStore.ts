import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  StudyPlan,
  PlannedCourse,
  ValidationError,
  CombinedDegreeProgress,
  DegreeComponentProgress,
  RequirementProgress,
  ApprovedCredit,
  ApprovedCreditLevel,
  MajorConfig,
  MajorProgress,
  CourseAttributionRow,
} from '../types';
import { courses } from '../data/courses';
import { degreeRequirements } from '../data/requirements';
import { getEquivalenceRegistry, getEquivalentCourses } from '../data/equivalences';
import { evaluateExpression, describeExpression } from '../utils/prerequisiteEvaluator';
import { validateCorequisites } from '../utils/corequisiteValidator';
import { EvaluationContext } from '../types/prerequisites';
import { getProgram, getDegree, getMaxYear, getDefaultDegreeAttribution, canUseAsElective } from '../data/degreeRegistry';
import {
  getDefaultMajorForDegree,
  getMajor,
  getMajorName,
  isCourseInMajor,
  resolveMajorCode,
} from '../data/majorRegistry';

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
  addApprovedCourseCredit: (planId: string, courseCode: string) => void;
  addUnspecifiedCredit: (planId: string, school: string, level: ApprovedCreditLevel, units?: number) => void;
  removeApprovedCredit: (planId: string, approvedCreditId: string) => void;
  removeCourse: (planId: string, courseCode: string) => void;
  moveCourse: (planId: string, courseCode: string, year: number, semester: 1 | 2) => void;
  markCompleted: (planId: string, courseCode: string) => void;
  unmarkCompleted: (planId: string, courseCode: string) => void;
  setCourseCountingOverride: (planId: string, courseCode: string, degrees: string[]) => void;
  setApprovedCreditCountingOverride: (planId: string, approvedCreditId: string, degrees: string[]) => void;
  setSelectedMajor: (planId: string, degreeCode: string, majorCode: string) => void;

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
const APPROVED_LEVELS: ApprovedCreditLevel[] = [1000, 2000, 3000, 4000];

interface DegreeCreditEntry {
  id: string;
  courseCode?: string;
  code: string;
  name: string;
  kind: 'planned' | 'approved';
  year?: number;
  semester?: 1 | 2;
  prefix: string;
  units: number;
  level: number;
  countTowardDegree?: string[];
}

const sanitizeApprovedCredits = (plan: StudyPlan): ApprovedCredit[] => plan.approvedCredits ?? [];
const sanitizeSelectedMajors = (plan: StudyPlan): Record<string, string> => {
  const program = getProgram(plan.program ?? 'AENGI');
  const selectedMajors = { ...(plan.selectedMajors ?? {}) };

  for (const degreeCode of program?.degreeComponents ?? []) {
    if (selectedMajors[degreeCode]) {
      selectedMajors[degreeCode] = resolveMajorCode(selectedMajors[degreeCode]);
      continue;
    }

    const defaultMajor = getDefaultMajorForDegree(degreeCode);
    if (defaultMajor) {
      selectedMajors[degreeCode] = defaultMajor;
    }
  }

  return selectedMajors;
};

const hydratePlan = (plan: StudyPlan): StudyPlan => ({
  ...plan,
  approvedCredits: sanitizeApprovedCredits(plan),
  selectedMajors: sanitizeSelectedMajors(plan),
});

const isApprovedLevel = (level: number): level is ApprovedCreditLevel =>
  APPROVED_LEVELS.includes(level as ApprovedCreditLevel);

const normalizeSchoolPrefix = (school: string): string => {
  return school.trim().toUpperCase().replace(/[^A-Z]/g, '');
};

const inferLevelFromCourseCode = (courseCode: string): number => {
  const match = courseCode.match(/(\d{4})/);
  if (!match) return 1000;
  const levelDigit = parseInt(match[1].charAt(0), 10);
  return Number.isNaN(levelDigit) ? 1000 : levelDigit * 1000;
};

const getCoursePrefix = (courseCode: string): string => {
  const match = courseCode.match(/^[A-Z]+/);
  return match ? match[0] : '';
};

const getApprovedCourseCodeSet = (plan: StudyPlan): Set<string> => {
  const approvedCourseCodes = sanitizeApprovedCredits(plan)
    .filter((credit): credit is ApprovedCredit & { kind: 'course'; courseCode: string } =>
      credit.kind === 'course' && Boolean(credit.courseCode)
    )
    .map(credit => credit.courseCode);
  return new Set(approvedCourseCodes);
};

const getApprovedCreditsForPrerequisiteEvaluation = (
  plan: StudyPlan
): {
  approvedCourseCodes: string[];
  unitContributions: Array<{ code: string; units: number; level: number }>;
} => {
  const approvedCourseCodes: string[] = [];
  const unitContributions: Array<{ code: string; units: number; level: number }> = [];

  for (const credit of sanitizeApprovedCredits(plan)) {
    if (credit.kind === 'course' && credit.courseCode) {
      approvedCourseCodes.push(credit.courseCode);
      const knownCourse = courses[credit.courseCode];
      if (!knownCourse) {
        unitContributions.push({
          code: credit.courseCode,
          units: credit.units > 0 ? credit.units : 6,
          level: inferLevelFromCourseCode(credit.courseCode),
        });
      }
      continue;
    }

    if (credit.kind === 'unspecified') {
      const school = normalizeSchoolPrefix(credit.school ?? '');
      const level = isApprovedLevel(credit.level ?? 0) ? (credit.level ?? 1000) : 1000;
      if (!school) continue;

      unitContributions.push({
        code: `${school}${level}-APPROVED-${credit.id}`,
        units: credit.units > 0 ? credit.units : 6,
        level,
      });
    }
  }

  return { approvedCourseCodes, unitContributions };
};

const buildDegreeCreditEntries = (plan: StudyPlan): DegreeCreditEntry[] => {
  const entries: DegreeCreditEntry[] = [];

  for (const plannedCourse of plan.courses) {
    const course = courses[plannedCourse.courseCode];
    if (!course) continue;
    entries.push({
      id: `planned:${plannedCourse.courseCode}`,
      courseCode: plannedCourse.courseCode,
      code: course.code,
      name: course.name,
      kind: 'planned',
      year: plannedCourse.year,
      semester: plannedCourse.semester,
      prefix: getCoursePrefix(course.code),
      units: course.units,
      level: course.level,
      countTowardDegree: plannedCourse.countTowardDegree,
    });
  }

  for (const approvedCredit of sanitizeApprovedCredits(plan)) {
    if (approvedCredit.kind === 'course' && approvedCredit.courseCode) {
      const knownCourse = courses[approvedCredit.courseCode];
      if (knownCourse) {
        entries.push({
          id: `approved:${approvedCredit.id}`,
          courseCode: approvedCredit.courseCode,
          code: knownCourse.code,
          name: knownCourse.name,
          kind: 'approved',
          prefix: getCoursePrefix(knownCourse.code),
          units: knownCourse.units,
          level: knownCourse.level,
          countTowardDegree: approvedCredit.countTowardDegree,
        });
      } else {
        entries.push({
          id: `approved:${approvedCredit.id}`,
          courseCode: approvedCredit.courseCode,
          code: approvedCredit.courseCode,
          name: approvedCredit.courseCode,
          kind: 'approved',
          prefix: getCoursePrefix(approvedCredit.courseCode),
          units: approvedCredit.units > 0 ? approvedCredit.units : 6,
          level: inferLevelFromCourseCode(approvedCredit.courseCode),
          countTowardDegree: approvedCredit.countTowardDegree,
        });
      }
      continue;
    }

    if (approvedCredit.kind === 'unspecified') {
      const school = normalizeSchoolPrefix(approvedCredit.school ?? '');
      const level = isApprovedLevel(approvedCredit.level ?? 0) ? (approvedCredit.level ?? 1000) : 1000;
      if (!school) continue;

      entries.push({
        id: `approved:${approvedCredit.id}`,
        code: `${school}${level}-APPROVED-${approvedCredit.id}`,
        name: `Unspecified ${school} ${level}-level credit`,
        kind: 'approved',
        prefix: school,
        units: approvedCredit.units > 0 ? approvedCredit.units : 6,
        level,
        countTowardDegree: approvedCredit.countTowardDegree,
      });
    }
  }

  return entries;
};

const matchesCourseOption = (entry: DegreeCreditEntry, courseCode: string): boolean => {
  if (!entry.courseCode) return false;
  return getEquivalentCourses(courseCode).includes(entry.courseCode);
};

const matchesCourseGroup = (entry: DegreeCreditEntry, courseGroup: string[]): boolean => {
  return courseGroup.some(courseCode => matchesCourseOption(entry, courseCode));
};

const getMatchingCourseCodes = (entries: DegreeCreditEntry[], courseGroups: string[][]): string[] => {
  return [...new Set(
    entries
      .filter(entry => entry.courseCode && courseGroups.some(group => matchesCourseGroup(entry, group)))
      .map(entry => entry.courseCode as string)
  )];
};

const getSelectedMajor = (plan: StudyPlan, degreeCode: string): MajorConfig | null => {
  const selectedMajorCode = sanitizeSelectedMajors(plan)[degreeCode];
  if (!selectedMajorCode) return null;
  return getMajor(selectedMajorCode) ?? null;
};

const buildMajorProgress = (
  major: MajorConfig,
  entries: DegreeCreditEntry[],
  canUseEntry: (entry: DegreeCreditEntry) => boolean,
  useEntry: (entry: DegreeCreditEntry, completedCourses: string[]) => number
): { progress: MajorProgress; completedUnits: number } => {
  const completedCourses: string[] = [];
  let completedUnits = 0;
  const groups = major.courseGroups.map((options, index) => {
    const found = entries.find(entry => canUseEntry(entry) && matchesCourseGroup(entry, options));
    if (found) {
      completedUnits += useEntry(found, completedCourses);
    }

    return {
      label: `Requirement ${index + 1}`,
      options,
      satisfiedBy: found?.courseCode,
    };
  });

  return {
    progress: {
      code: major.code,
      name: major.name,
      degreeCode: major.degreeCode,
      required: major.totalUnits,
      completed: Math.min(completedUnits, major.totalUnits),
      completedCourses,
      eligibleCourses: getMatchingCourseCodes(entries, major.courseGroups),
      groups,
    },
    completedUnits,
  };
};

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
        const newPlan = {
          id,
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          startYear,
          startSemester,
          program,
          courses: [],
          approvedCredits: [],
          selectedMajors: {},
          completedCourses: [],
        };
        const hydratedPlan: StudyPlan = {
          ...newPlan,
          selectedMajors: sanitizeSelectedMajors(newPlan as StudyPlan),
        };
        set(state => ({
          plans: [...state.plans, hydratedPlan],
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
          approvedCredits: sanitizeApprovedCredits(plan).map(credit => ({ ...credit })),
          selectedMajors: sanitizeSelectedMajors(plan),
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

      setSelectedMajor: (planId: string, degreeCode: string, majorCode: string) => {
        const resolvedMajorCode = resolveMajorCode(majorCode);
        set(state => ({
          plans: state.plans.map(p => {
            if (p.id !== planId) return p;
            return {
              ...p,
              selectedMajors: {
                ...sanitizeSelectedMajors(p),
                [degreeCode]: resolvedMajorCode,
              },
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      addCourse: (planId: string, courseCode: string, year: number, semester: 1 | 2) => {
        const course = courses[courseCode];
        const semesterSpan = course?.semesterSpan ?? 1;

        set(state => ({
          plans: state.plans.map(p => {
            if (p.id !== planId) return p;
            const exists = p.courses.some(c => c.courseCode === courseCode);
            if (exists) return p;
            if (getApprovedCourseCodeSet(p).has(courseCode)) return p;

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

      addApprovedCourseCredit: (planId: string, courseCode: string) => {
        const course = courses[courseCode];
        if (!course) return;

        set(state => ({
          plans: state.plans.map(p => {
            if (p.id !== planId) return p;

            const alreadyPlanned = p.courses.some(c => c.courseCode === courseCode);
            const alreadyApproved = getApprovedCourseCodeSet(p).has(courseCode);
            if (alreadyPlanned || alreadyApproved) return p;

            return {
              ...p,
              approvedCredits: [
                ...sanitizeApprovedCredits(p),
                {
                  id: generateId(),
                  kind: 'course',
                  courseCode,
                  units: course.units,
                },
              ],
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      addUnspecifiedCredit: (planId: string, school: string, level: ApprovedCreditLevel, units: number = 6) => {
        const normalizedSchool = normalizeSchoolPrefix(school);
        if (!normalizedSchool || !isApprovedLevel(level)) return;
        const validUnits = Number.isFinite(units) && units > 0 ? units : 6;

        set(state => ({
          plans: state.plans.map(p => {
            if (p.id !== planId) return p;

            return {
              ...p,
              approvedCredits: [
                ...sanitizeApprovedCredits(p),
                {
                  id: generateId(),
                  kind: 'unspecified',
                  school: normalizedSchool,
                  level,
                  units: validUnits,
                },
              ],
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      removeApprovedCredit: (planId: string, approvedCreditId: string) => {
        set(state => ({
          plans: state.plans.map(p => {
            if (p.id !== planId) return p;
            return {
              ...p,
              approvedCredits: sanitizeApprovedCredits(p).filter(credit => credit.id !== approvedCreditId),
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

      setApprovedCreditCountingOverride: (planId: string, approvedCreditId: string, degrees: string[]) => {
        set(state => ({
          plans: state.plans.map(p => {
            if (p.id !== planId) return p;
            return {
              ...p,
              approvedCredits: sanitizeApprovedCredits(p).map(credit =>
                credit.id === approvedCreditId
                  ? { ...credit, countTowardDegree: degrees.length > 0 ? degrees : undefined }
                  : credit
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
        const plan = state.plans.find(p => p.id === state.activePlanId);
        return plan ? hydratePlan(plan) : null;
      },

      getPlanById: (id: string) => {
        const plan = get().plans.find(p => p.id === id);
        return plan ? hydratePlan(plan) : undefined;
      },

      getCoursesForSemester: (planId: string, year: number, semester: 1 | 2) => {
        const sourcePlan = get().plans.find(p => p.id === planId);
        const plan = sourcePlan ? hydratePlan(sourcePlan) : undefined;
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
        const sourcePlan = get().plans.find(p => p.id === planId);
        const plan = sourcePlan ? hydratePlan(sourcePlan) : undefined;
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

        const approvedCreditData = getApprovedCreditsForPrerequisiteEvaluation(plan);
        const completedSet = new Set([
          ...priorCourseCodes,
          ...plan.completedCourses,
          ...approvedCreditData.approvedCourseCodes,
        ]);
        const completedCoursesData = [...completedSet]
          .map(code => courses[code])
          .filter(Boolean)
          .map(c => ({ code: c.code, units: c.units, level: c.level }));
        completedCoursesData.push(...approvedCreditData.unitContributions);

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
        const sourcePlan = get().plans.find(p => p.id === planId);
        const plan = sourcePlan ? hydratePlan(sourcePlan) : undefined;
        if (!plan) return [];

        const errors: ValidationError[] = [];
        const maxYear = getMaxYear(plan.program ?? 'AENGI');
        const approvedCourseCodes = getApprovedCourseCodeSet(plan);
        const plannedCodes = plan.courses.map(c => c.courseCode);

        for (const approvedCode of approvedCourseCodes) {
          if (plannedCodes.includes(approvedCode)) {
            errors.push({
              courseCode: approvedCode,
              type: 'incompatible',
              message: `${approvedCode} is both in semesters and approved credit`,
            });
          }
        }

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
            course.incompatible.forEach(incomp => {
              if (plannedCodes.includes(incomp) || approvedCourseCodes.has(incomp)) {
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
        const sourcePlan = get().plans.find(p => p.id === planId);
        const plan = sourcePlan ? hydratePlan(sourcePlan) : undefined;
        const reqs = degreeRequirements.singleDegree.requirements;
        const selectedMajor = plan ? getSelectedMajor(plan, 'AENGI') : null;

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

        const entries = buildDegreeCreditEntries(plan);
        const courseEntriesByCode = new Map<string, DegreeCreditEntry>();
        entries.forEach(entry => {
          if (entry.courseCode && !courseEntriesByCode.has(entry.courseCode)) {
            courseEntriesByCode.set(entry.courseCode, entry);
          }
        });
        const usedForCategory = new Set<string>();

        // Foundations
        const foundationCourses = reqs.foundations.courses.filter(code => courseEntriesByCode.has(code));
        foundationCourses.forEach(code => usedForCategory.add(code));
        const foundationUnits = foundationCourses.reduce(
          (sum, code) => sum + (courseEntriesByCode.get(code)?.units ?? 0),
          0
        );

        // Engineering Fundamentals
        const engFundCourses = reqs.engineeringFundamentals.courses.filter(code => courseEntriesByCode.has(code));
        engFundCourses.forEach(code => usedForCategory.add(code));
        const engFundUnits = engFundCourses.reduce(
          (sum, code) => sum + (courseEntriesByCode.get(code)?.units ?? 0),
          0
        );

        // Professional Core
        const profCoreCourses = reqs.professionalCore.courses.filter(code => courseEntriesByCode.has(code));
        profCoreCourses.forEach(code => usedForCategory.add(code));
        const profCoreUnits = profCoreCourses.reduce(
          (sum, code) => sum + (courseEntriesByCode.get(code)?.units ?? 0),
          0
        );

        // Major (selected engineering major, if configured)
        const majorActual: string[] = [];
        const seenMajorCourses = new Set<string>();
        selectedMajor?.courseGroups.forEach(group => {
          const foundCode = group.find(code => {
            const equivalents = getEquivalentCourses(code);
            return equivalents.some(equivalentCode => courseEntriesByCode.has(equivalentCode));
          });
          if (!foundCode) return;

          const matchedCode = getEquivalentCourses(foundCode).find(equivalentCode => courseEntriesByCode.has(equivalentCode));
          if (matchedCode && !seenMajorCourses.has(matchedCode)) {
            seenMajorCourses.add(matchedCode);
            majorActual.push(matchedCode);
          }
        });
        majorActual.forEach(code => usedForCategory.add(code));
        const majorUnits = majorActual.reduce(
          (sum, code) => sum + (courseEntriesByCode.get(code)?.units ?? 0),
          0
        );

        // Capstone
        const capstoneCourses = reqs.capstone.courses.filter(code => courseEntriesByCode.has(code));
        capstoneCourses.forEach(code => usedForCategory.add(code));
        const capstoneUnits = capstoneCourses.reduce(
          (sum, code) => sum + (courseEntriesByCode.get(code)?.units ?? 0),
          0
        );

        // Electives (remaining ENGN courses and others, including unspecified approved credits)
        const remainingEngn: string[] = [];
        const remainingOther: string[] = [];
        let engnElectiveUnits = 0;
        let uniElectiveUnits = 0;

        entries.forEach(entry => {
          if (entry.courseCode && usedForCategory.has(entry.courseCode)) return;

          if (entry.prefix === 'ENGN') {
            engnElectiveUnits += entry.units;
            if (entry.courseCode) remainingEngn.push(entry.courseCode);
          } else {
            uniElectiveUnits += entry.units;
            if (entry.courseCode) remainingOther.push(entry.courseCode);
          }
        });

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
        const sourcePlan = get().plans.find(p => p.id === planId);
        const plan = sourcePlan ? hydratePlan(sourcePlan) : undefined;
        if (!plan) return null;

        const programCode = plan.program ?? 'AENGI';
        const program = getProgram(programCode);
        if (!program) return null;

        const creditEntries = buildDegreeCreditEntries(plan);
        const entryById = new Map(creditEntries.map(entry => [entry.id, entry] as const));
        const attributionByEntryId = new Map<string, string[]>();
        const selectedMajors = sanitizeSelectedMajors(plan);

        for (const entry of creditEntries) {
          let attribution: string[] = [];
          if (entry.countTowardDegree && entry.countTowardDegree.length > 0) {
            attribution = entry.countTowardDegree;
          } else if (!program.isDoubleDegree) {
            attribution = [program.degreeComponents[0]];
          } else if (entry.courseCode) {
            attribution = getDefaultDegreeAttribution(entry.courseCode, programCode);
          }
          attributionByEntryId.set(entry.id, attribution);
        }

        const canCountForDegree = (entry: DegreeCreditEntry, degreeCode: string): boolean => {
          const attribution = attributionByEntryId.get(entry.id) ?? [];
          return attribution.length === 0 || attribution.includes(degreeCode);
        };

        const sharedEntries = new Set(
          creditEntries
            .filter(entry => (attributionByEntryId.get(entry.id)?.length ?? 0) > 1)
            .map(entry => entry.id)
        );

        const calculateDegreeProgress = (
          degreeCode: string,
          usedByOther: Set<string>
        ): { progress: DegreeComponentProgress; usedEntries: Set<string> } => {
          const degree = getDegree(degreeCode);
          if (!degree) {
            return {
              progress: {
                name: degreeCode,
                code: degreeCode,
                requirements: {},
                selectedMajor: null,
                attributedUnits: 0,
                total: { required: 0, completed: 0 },
              },
              usedEntries: new Set(),
            };
          }

          const requirements: Record<string, RequirementProgress> = {};
          const usedInThisDegree = new Set<string>();
          const selectedMajor = getSelectedMajor(plan, degreeCode);
          let selectedMajorProgress: MajorProgress | null = null;

          const isAvailable = (entry: DegreeCreditEntry): boolean => {
            return (
              !usedByOther.has(entry.id) &&
              !usedInThisDegree.has(entry.id) &&
              canCountForDegree(entry, degreeCode)
            );
          };

          const useEntry = (entry: DegreeCreditEntry, completedCourses: string[]): number => {
            usedInThisDegree.add(entry.id);
            if (entry.courseCode) {
              completedCourses.push(entry.courseCode);
            }
            return entry.units;
          };

          for (const [key, category] of Object.entries(degree.requirements)) {
            const completedCourses: string[] = [];
            let completedUnits = 0;
            let eligibleCourses: string[] = [];
            let remainingCourseGroups: string[][] = [];
            let requiredUnits = category.units;

            if (key === 'major' && selectedMajor) {
              const majorResult = buildMajorProgress(
                selectedMajor,
                creditEntries,
                entry => isAvailable(entry),
                useEntry
              );
              selectedMajorProgress = majorResult.progress;
              completedUnits = majorResult.completedUnits;
              eligibleCourses = majorResult.progress.eligibleCourses;
              remainingCourseGroups = majorResult.progress.groups
                .filter(group => !group.satisfiedBy)
                .map(group => group.options);
              requiredUnits = selectedMajor.totalUnits;

              requirements[key] = {
                name: `${selectedMajor.name} Major`,
                description: `Selected major for ${degree.name}`,
                required: requiredUnits,
                completed: Math.min(completedUnits, requiredUnits),
                courses: selectedMajor.courseGroups.flat(),
                completedCourses: [...new Set(majorResult.progress.completedCourses)],
                remainingUnits: Math.max(0, requiredUnits - Math.min(completedUnits, requiredUnits)),
                eligibleCourses,
                remainingCourseGroups,
              };
              continue;
            }

            if (category.coursesMandatory === false && category.courses) {
              const poolOptions = category.courses.flat();
              const poolGroups = [poolOptions];
              eligibleCourses = getMatchingCourseCodes(
                creditEntries.filter(entry => canCountForDegree(entry, degreeCode)),
                poolGroups
              );

              for (const entry of creditEntries) {
                if (completedUnits >= requiredUnits) break;
                if (!isAvailable(entry)) continue;
                if (!matchesCourseGroup(entry, poolOptions)) continue;
                completedUnits += useEntry(entry, completedCourses);
              }

              if (completedUnits < requiredUnits) {
                remainingCourseGroups = poolGroups;
              }
            } else if (category.courses) {
              const courseGroups = category.courses.map(courseSpec =>
                Array.isArray(courseSpec) ? courseSpec : [courseSpec]
              );
              eligibleCourses = getMatchingCourseCodes(
                creditEntries.filter(entry => canCountForDegree(entry, degreeCode)),
                courseGroups
              );

              for (const courseSpec of category.courses) {
                if (Array.isArray(courseSpec)) {
                  const found = creditEntries.find(entry =>
                    matchesCourseGroup(entry, courseSpec) && isAvailable(entry)
                  );
                  if (found) {
                    completedUnits += useEntry(found, completedCourses);
                  } else {
                    remainingCourseGroups.push(courseSpec);
                  }
                } else {
                  const found = creditEntries.find(entry =>
                    matchesCourseOption(entry, courseSpec) && isAvailable(entry)
                  );
                  if (found) {
                    completedUnits += useEntry(found, completedCourses);
                  } else {
                    remainingCourseGroups.push([courseSpec]);
                  }
                }
              }
            }

            if (category.prefixRequirements) {
              eligibleCourses = [
                ...new Set(
                  creditEntries
                    .filter(entry => canCountForDegree(entry, degreeCode))
                    .filter(entry => entry.courseCode && category.prefixRequirements?.some(prefixReq => entry.prefix.startsWith(prefixReq.prefix)))
                    .map(entry => entry.courseCode as string)
                ),
              ];

              for (const prefixReq of category.prefixRequirements) {
                let prefixUnits = 0;
                for (const entry of creditEntries) {
                  if (prefixUnits >= prefixReq.minUnits) break;
                  if (!isAvailable(entry)) continue;
                  if (!entry.prefix.startsWith(prefixReq.prefix)) continue;
                  prefixUnits += useEntry(entry, completedCourses);
                }
                completedUnits += Math.min(prefixUnits, prefixReq.minUnits);
              }
            }

            if (!category.courses && !category.prefixRequirements && category.units > 0) {
              eligibleCourses = [
                ...new Set(
                  creditEntries
                    .filter(entry => canCountForDegree(entry, degreeCode))
                    .filter(entry =>
                      !entry.courseCode ||
                      !program.isDoubleDegree ||
                      canUseAsElective(entry.courseCode, degreeCode, programCode)
                    )
                    .map(entry => entry.courseCode)
                    .filter(Boolean) as string[]
                ),
              ];

              for (const entry of creditEntries) {
                if (completedUnits >= category.units) break;
                if (!isAvailable(entry)) continue;

                if (
                  entry.courseCode &&
                  program.isDoubleDegree &&
                  !canUseAsElective(entry.courseCode, degreeCode, programCode)
                ) {
                  continue;
                }

                completedUnits += useEntry(entry, completedCourses);
              }
            }

            requirements[key] = {
              name: category.name,
              description: category.description,
              required: requiredUnits,
              completed: Math.min(completedUnits, requiredUnits),
              courses: category.courses?.flat() ?? [],
              completedCourses: [...new Set(completedCourses)],
              remainingUnits: Math.max(0, requiredUnits - Math.min(completedUnits, requiredUnits)),
              eligibleCourses,
              remainingCourseGroups,
            };
          }

          const attributedUnits = [...usedInThisDegree].reduce(
            (sum, entryId) => sum + (entryById.get(entryId)?.units ?? 0),
            0
          );

          return {
            progress: {
              name: degree.name,
              code: degree.code,
              requirements,
              selectedMajor: selectedMajorProgress,
              attributedUnits,
              total: {
                required: degree.totalUnits,
                completed: Math.min(attributedUnits, degree.totalUnits),
              },
            },
            usedEntries: usedInThisDegree,
          };
        };

        const { progress: primary, usedEntries: primaryUsedEntries } = calculateDegreeProgress(
          program.degreeComponents[0],
          new Set()
        );

        let secondary: DegreeComponentProgress | undefined;
        let secondaryUsedEntries = new Set<string>();

        if (program.isDoubleDegree) {
          const usedByPrimary = new Set<string>();
          for (const entryId of primaryUsedEntries) {
            if (!sharedEntries.has(entryId)) {
              usedByPrimary.add(entryId);
            }
          }

          const secondaryResult = calculateDegreeProgress(program.degreeComponents[1], usedByPrimary);
          secondary = secondaryResult.progress;
          secondaryUsedEntries = secondaryResult.usedEntries;
        }

        const allUsedEntryIds = new Set<string>([...primaryUsedEntries, ...secondaryUsedEntries]);
        const sharedUsedEntryIds = new Set(
          [...primaryUsedEntries].filter(entryId => secondaryUsedEntries.has(entryId))
        );
        const overallCompleted = [...allUsedEntryIds].reduce(
          (sum, entryId) => sum + (entryById.get(entryId)?.units ?? 0),
          0
        );
        const sharedUnits = [...sharedUsedEntryIds].reduce(
          (sum, entryId) => sum + (entryById.get(entryId)?.units ?? 0),
          0
        );
        const unallocatedUnits = creditEntries
          .filter(entry => !allUsedEntryIds.has(entry.id))
          .reduce((sum, entry) => sum + entry.units, 0);

        const attributionRows: CourseAttributionRow[] = creditEntries
          .map(entry => {
            const defaultDegreeCodes = !program.isDoubleDegree
              ? [program.degreeComponents[0]]
              : entry.courseCode
              ? getDefaultDegreeAttribution(entry.courseCode, programCode)
              : [];
            const assignedDegreeCodes = attributionByEntryId.get(entry.id) ?? [];
            const usedByDegreeCodes = [
              ...(primaryUsedEntries.has(entry.id) ? [program.degreeComponents[0]] : []),
              ...(secondaryUsedEntries.has(entry.id) && program.degreeComponents[1]
                ? [program.degreeComponents[1]]
                : []),
            ];
            const selectedMajorCodes = entry.courseCode
              ? program.degreeComponents
                  .map(degreeCode => selectedMajors[degreeCode])
                  .filter((majorCode): majorCode is string =>
                    Boolean(majorCode) && isCourseInMajor(entry.courseCode as string, majorCode)
                  )
              : [];

            return {
              id: entry.id,
              code: entry.code,
              name: entry.name,
              units: entry.units,
              kind: entry.kind,
              year: entry.year,
              semester: entry.semester,
              defaultDegreeCodes,
              assignedDegreeCodes,
              usedByDegreeCodes,
              selectedMajorCodes,
              selectedMajorNames: selectedMajorCodes.map(getMajorName),
              isShared: assignedDegreeCodes.length > 1 || usedByDegreeCodes.length > 1,
              isUnallocated: usedByDegreeCodes.length === 0,
            };
          })
          .sort((left, right) => {
            if (left.kind !== right.kind) return left.kind === 'planned' ? -1 : 1;
            if ((left.year ?? 0) !== (right.year ?? 0)) return (left.year ?? 0) - (right.year ?? 0);
            if ((left.semester ?? 0) !== (right.semester ?? 0)) return (left.semester ?? 0) - (right.semester ?? 0);
            return left.code.localeCompare(right.code);
          });

        return {
          programCode,
          programName: program.name,
          isDoubleDegree: program.isDoubleDegree,
          primary,
          secondary,
          sharedUnits,
          unallocatedUnits,
          attributionRows,
          overallTotal: { required: program.totalUnits, completed: overallCompleted },
        };
      },
    }),
    {
      name: 'anu-study-planner-storage',
    }
  )
);
