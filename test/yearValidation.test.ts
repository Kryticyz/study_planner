import { describe, it, expect, beforeEach } from 'bun:test';
import { usePlanStore } from '../src/store/planStore';

describe('Year Validation', () => {
  beforeEach(() => {
    // Reset the store state before each test
    usePlanStore.setState({ plans: [], activePlanId: null });
  });

  describe('addCourse year bounds', () => {
    it('allows courses in years 1-4 for single degree', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('Single Degree', 2025, 1, 'AENGI');

      // Add courses in all 4 years
      usePlanStore.getState().addCourse(planId, 'COMP1100', 1, 1);
      usePlanStore.getState().addCourse(planId, 'COMP2100', 2, 1);
      usePlanStore.getState().addCourse(planId, 'COMP3600', 3, 1);
      usePlanStore.getState().addCourse(planId, 'COMP4620', 4, 1);

      const plan = usePlanStore.getState().getPlanById(planId);
      expect(plan?.courses.length).toBe(4);
    });

    it('prevents adding courses beyond year 4 for single degree', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('Single Degree', 2025, 1, 'AENGI');

      usePlanStore.getState().addCourse(planId, 'COMP1100', 5, 1);

      const plan = usePlanStore.getState().getPlanById(planId);
      expect(plan?.courses.length).toBe(0);
    });

    it('allows courses in years 1-6 for double degree', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('Double Degree', 2025, 1, 'AENGI-BCOMP');

      // Add courses in all 6 years
      usePlanStore.getState().addCourse(planId, 'COMP1100', 1, 1);
      usePlanStore.getState().addCourse(planId, 'COMP2100', 2, 1);
      usePlanStore.getState().addCourse(planId, 'COMP2310', 3, 1);
      usePlanStore.getState().addCourse(planId, 'COMP3600', 4, 1);
      usePlanStore.getState().addCourse(planId, 'COMP3620', 5, 1);
      usePlanStore.getState().addCourse(planId, 'COMP4620', 6, 1);

      const plan = usePlanStore.getState().getPlanById(planId);
      expect(plan?.courses.length).toBe(6);
    });

    it('prevents adding courses beyond year 6 for double degree', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('Double Degree', 2025, 1, 'AENGI-BCOMP');

      usePlanStore.getState().addCourse(planId, 'COMP1100', 7, 1);

      const plan = usePlanStore.getState().getPlanById(planId);
      expect(plan?.courses.length).toBe(0);
    });
  });

  describe('moveCourse year bounds', () => {
    it('allows moving courses to year 5 in double degree', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('Double Degree', 2025, 1, 'AENGI-BCOMP');

      usePlanStore.getState().addCourse(planId, 'COMP1100', 1, 1);
      usePlanStore.getState().moveCourse(planId, 'COMP1100', 5, 1);

      const plan = usePlanStore.getState().getPlanById(planId);
      const course = plan?.courses.find(c => c.courseCode === 'COMP1100');
      expect(course?.year).toBe(5);
    });

    it('prevents moving courses beyond max year', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('Single Degree', 2025, 1, 'AENGI');

      usePlanStore.getState().addCourse(planId, 'COMP1100', 1, 1);
      usePlanStore.getState().moveCourse(planId, 'COMP1100', 5, 1);

      const plan = usePlanStore.getState().getPlanById(planId);
      const course = plan?.courses.find(c => c.courseCode === 'COMP1100');
      expect(course?.year).toBe(1); // Should remain at original position
    });
  });

  describe('validatePlan semester overload', () => {
    it('checks overload for all years in double degree', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('Double Degree', 2025, 1, 'AENGI-BCOMP');

      // Add 5 courses (30 units) to year 5 - should trigger overload
      usePlanStore.getState().addCourse(planId, 'COMP1100', 5, 1);
      usePlanStore.getState().addCourse(planId, 'COMP1110', 5, 1);
      usePlanStore.getState().addCourse(planId, 'COMP2100', 5, 1);
      usePlanStore.getState().addCourse(planId, 'COMP2310', 5, 1);
      usePlanStore.getState().addCourse(planId, 'COMP3600', 5, 1);

      const errors = usePlanStore.getState().validatePlan(planId);
      const overloadErrors = errors.filter(e => e.type === 'overload');
      expect(overloadErrors.length).toBeGreaterThan(0);
      expect(overloadErrors[0].message).toContain('Year 5');
    });
  });

  describe('getSemesterUnits', () => {
    it('calculates units for year 5', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('Double Degree', 2025, 1, 'AENGI-BCOMP');

      usePlanStore.getState().addCourse(planId, 'COMP1100', 5, 1);
      usePlanStore.getState().addCourse(planId, 'COMP1110', 5, 1);

      const units = usePlanStore.getState().getSemesterUnits(planId, 5, 1);
      expect(units).toBe(12);
    });
  });

  describe('getCoursesForSemester', () => {
    it('returns courses for year 5', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('Double Degree', 2025, 1, 'AENGI-BCOMP');

      usePlanStore.getState().addCourse(planId, 'COMP1100', 5, 1);
      usePlanStore.getState().addCourse(planId, 'COMP1110', 5, 2);
      usePlanStore.getState().addCourse(planId, 'COMP2100', 6, 1);

      const year5S1 = usePlanStore.getState().getCoursesForSemester(planId, 5, 1);
      const year5S2 = usePlanStore.getState().getCoursesForSemester(planId, 5, 2);
      const year6S1 = usePlanStore.getState().getCoursesForSemester(planId, 6, 1);

      expect(year5S1.length).toBe(1);
      expect(year5S1[0].courseCode).toBe('COMP1100');
      expect(year5S2.length).toBe(1);
      expect(year5S2[0].courseCode).toBe('COMP1110');
      expect(year6S1.length).toBe(1);
      expect(year6S1[0].courseCode).toBe('COMP2100');
    });
  });
});
