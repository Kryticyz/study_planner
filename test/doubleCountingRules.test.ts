import { describe, it, expect, beforeEach } from 'bun:test';
import { usePlanStore } from '../src/store/planStore';
import {
  isSharedMandatory,
  isCoreForDegree,
  canUseAsElective,
  getDefaultDegreeAttribution,
} from '../src/data/degreeRegistry';

describe('Double Counting Rules', () => {
  beforeEach(() => {
    // Reset the store state before each test
    usePlanStore.setState({ plans: [], activePlanId: null });
  });

  describe('Shared Mandatory Courses', () => {
    it('identifies ENGN2219 as shared between AENGI and BCOMP', () => {
      expect(isSharedMandatory('ENGN2219', 'AENGI-BCOMP')).toBe(true);
    });

    it('identifies COMP2300 as shared between AENGI and BCOMP', () => {
      expect(isSharedMandatory('COMP2300', 'AENGI-BCOMP')).toBe(true);
    });

    it('MATH1013 is shared (core for AENGI, in BCOMP shared list)', () => {
      expect(isSharedMandatory('MATH1013', 'AENGI-BCOMP')).toBe(true);
    });

    it('COMP2100 is NOT shared (only core for BCOMP)', () => {
      expect(isSharedMandatory('COMP2100', 'AENGI-BCOMP')).toBe(false);
    });
  });

  describe('Core Course Identification', () => {
    it('identifies MATH1013 as core for Engineering', () => {
      expect(isCoreForDegree('MATH1013', 'AENGI')).toBe(true);
    });

    it('identifies COMP1600 as core for Computing', () => {
      expect(isCoreForDegree('COMP1600', 'BCOMP')).toBe(true);
    });

    it('identifies COMP2400 as core for Computing', () => {
      expect(isCoreForDegree('COMP2400', 'BCOMP')).toBe(true);
    });

    it('handles choice groups - COMP1100 or COMP1130 both count as core for BCOMP', () => {
      expect(isCoreForDegree('COMP1100', 'BCOMP')).toBe(true);
      expect(isCoreForDegree('COMP1130', 'BCOMP')).toBe(true);
    });
  });

  describe('Elective Usage Prevention', () => {
    it('MATH1013 cannot be used as BCOMP elective (it is core for AENGI)', () => {
      // MATH1013 is core for AENGI, so it cannot be an elective for BCOMP
      expect(canUseAsElective('MATH1013', 'BCOMP', 'AENGI-BCOMP')).toBe(false);
    });

    it('COMP1600 cannot be used as AENGI elective (it is core for BCOMP)', () => {
      expect(canUseAsElective('COMP1600', 'AENGI', 'AENGI-BCOMP')).toBe(false);
    });

    it('random elective course can be used for either degree', () => {
      // COMP3500 is not core for either degree
      expect(canUseAsElective('COMP3500', 'AENGI', 'AENGI-BCOMP')).toBe(true);
      expect(canUseAsElective('COMP3500', 'BCOMP', 'AENGI-BCOMP')).toBe(true);
    });
  });

  describe('Default Degree Attribution', () => {
    it('shared mandatory courses default to both degrees', () => {
      const attribution = getDefaultDegreeAttribution('ENGN2219', 'AENGI-BCOMP');
      expect(attribution).toContain('AENGI');
      expect(attribution).toContain('BCOMP');
      expect(attribution.length).toBe(2);
    });

    it('BCOMP-only core courses default to BCOMP', () => {
      const attribution = getDefaultDegreeAttribution('COMP1600', 'AENGI-BCOMP');
      expect(attribution).toEqual(['BCOMP']);
    });

    it('AENGI-only core courses default to AENGI', () => {
      const attribution = getDefaultDegreeAttribution('ENGN2217', 'AENGI-BCOMP');
      expect(attribution).toEqual(['AENGI']);
    });

    it('manual override takes precedence', () => {
      const attribution = getDefaultDegreeAttribution('COMP1100', 'AENGI-BCOMP', ['AENGI']);
      expect(attribution).toEqual(['AENGI']);
    });
  });

  describe('Course Counting Override', () => {
    it('allows setting manual course counting override', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('Double Degree', 2025, 1, 'AENGI-BCOMP');

      usePlanStore.getState().addCourse(planId, 'COMP1100', 1, 1);
      usePlanStore.getState().setCourseCountingOverride(planId, 'COMP1100', ['BCOMP']);

      const plan = usePlanStore.getState().getPlanById(planId);
      const course = plan?.courses.find(c => c.courseCode === 'COMP1100');
      expect(course?.countTowardDegree).toEqual(['BCOMP']);
    });

    it('allows setting course to count for both degrees', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('Double Degree', 2025, 1, 'AENGI-BCOMP');

      usePlanStore.getState().addCourse(planId, 'COMP2300', 2, 1);
      usePlanStore.getState().setCourseCountingOverride(planId, 'COMP2300', ['AENGI', 'BCOMP']);

      const plan = usePlanStore.getState().getPlanById(planId);
      const course = plan?.courses.find(c => c.courseCode === 'COMP2300');
      expect(course?.countTowardDegree).toEqual(['AENGI', 'BCOMP']);
    });

    it('removes override when empty array provided', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('Double Degree', 2025, 1, 'AENGI-BCOMP');

      usePlanStore.getState().addCourse(planId, 'COMP1100', 1, 1);
      usePlanStore.getState().setCourseCountingOverride(planId, 'COMP1100', ['BCOMP']);
      usePlanStore.getState().setCourseCountingOverride(planId, 'COMP1100', []);

      const plan = usePlanStore.getState().getPlanById(planId);
      const course = plan?.courses.find(c => c.courseCode === 'COMP1100');
      expect(course?.countTowardDegree).toBeUndefined();
    });
  });
});
