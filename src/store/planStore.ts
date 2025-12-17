import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StudyPlan, PlannedCourse, ValidationError } from '../types';
import { courses } from '../data/courses';
import { degreeRequirements, electronicsCommunicationsMajor } from '../data/requirements';

interface PlanStore {
  plans: StudyPlan[];
  activePlanId: string | null;
  comparisonPlanIds: string[];
  isCompareMode: boolean;

  // Actions
  createPlan: (name: string, startYear?: number) => string;
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
}

const generateId = () => Math.random().toString(36).substring(2, 15);

export const usePlanStore = create<PlanStore>()(
  persist(
    (set, get) => ({
      plans: [],
      activePlanId: null,
      comparisonPlanIds: [],
      isCompareMode: false,

      createPlan: (name: string, startYear = 2025) => {
        const id = generateId();
        const newPlan: StudyPlan = {
          id,
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          startYear,
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
        set(state => ({
          plans: state.plans.map(p => {
            if (p.id !== planId) return p;
            const exists = p.courses.some(c => c.courseCode === courseCode);
            if (exists) return p;
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
        set(state => ({
          plans: state.plans.map(p => {
            if (p.id !== planId) return p;
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
        return plan.courses.filter(c => c.year === year && c.semester === semester);
      },

      getPrerequisitesMet: (planId: string, courseCode: string, year: number, semester: 1 | 2) => {
        const plan = get().plans.find(p => p.id === planId);
        if (!plan) return false;

        const course = courses[courseCode];
        if (!course) return false;
        if (course.prerequisites.length === 0) return true;

        const priorCourses = plan.courses
          .filter(c => c.year < year || (c.year === year && c.semester < semester))
          .map(c => c.courseCode);

        const completedSet = new Set([...priorCourses, ...plan.completedCourses]);

        if (course.prerequisiteAlternatives && course.prerequisiteAlternatives.length > 0) {
          return course.prerequisiteAlternatives.some(altGroup =>
            altGroup.every(prereq => completedSet.has(prereq))
          );
        }

        return course.prerequisites.every(prereq => completedSet.has(prereq));
      },

      getSemesterUnits: (planId: string, year: number, semester: 1 | 2) => {
        const semesterCourses = get().getCoursesForSemester(planId, year, semester);
        return semesterCourses.reduce((total, c) => {
          const course = courses[c.courseCode];
          return total + (course?.units || 0);
        }, 0);
      },

      validatePlan: (planId: string) => {
        const plan = get().plans.find(p => p.id === planId);
        if (!plan) return [];

        const errors: ValidationError[] = [];

        plan.courses.forEach(pc => {
          const course = courses[pc.courseCode];
          if (!course) return;

          // Check prerequisites
          if (!get().getPrerequisitesMet(planId, pc.courseCode, pc.year, pc.semester)) {
            errors.push({
              courseCode: pc.courseCode,
              type: 'prerequisite',
              message: `Prerequisites not met: ${course.prerequisites.join(', ')}`,
            });
          }

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
        });

        // Check semester overload
        for (let year = 1; year <= 4; year++) {
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
    }),
    {
      name: 'anu-study-planner-storage',
    }
  )
);
