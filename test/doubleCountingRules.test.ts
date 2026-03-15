import { describe, it, expect, beforeEach } from 'bun:test';
import { usePlanStore } from '../src/store/planStore';
import {
  isSharedMandatory,
  isMandatoryForDegree,
  isCoreForDegree,
  canUseAsElective,
  getDefaultDegreeAttribution,
} from '../src/data/degreeRegistry';

describe('Double Counting Rules', () => {
  beforeEach(() => {
    // Reset the store state before each test
    usePlanStore.setState({ plans: [], activePlanId: null });
  });

  describe('Mandatory Course Identification', () => {
    it('MATH1013 is mandatory for AENGI (in foundations)', () => {
      expect(isMandatoryForDegree('MATH1013', 'AENGI')).toBe(true);
    });

    it('MATH1013 is NOT mandatory for BCOMP (only in ICT Related Course pool)', () => {
      expect(isMandatoryForDegree('MATH1013', 'BCOMP')).toBe(false);
    });

    it('COMP2300 is mandatory for BCOMP (in core)', () => {
      expect(isMandatoryForDegree('COMP2300', 'BCOMP')).toBe(true);
    });

    it('ENGN2219 is mandatory for AENGI (in engineeringFundamentals)', () => {
      expect(isMandatoryForDegree('ENGN2219', 'AENGI')).toBe(true);
    });

    it('ENGN2219 is mandatory for BCOMP via equivalence with COMP2300', () => {
      expect(isMandatoryForDegree('ENGN2219', 'BCOMP')).toBe(true);
    });

    it('COMP2300 is mandatory for AENGI via equivalence with ENGN2219', () => {
      expect(isMandatoryForDegree('COMP2300', 'AENGI')).toBe(true);
    });

    it('COMP1100 is mandatory for AENGI (in foundations)', () => {
      expect(isMandatoryForDegree('COMP1100', 'AENGI')).toBe(true);
    });

    it('COMP1100 is mandatory for BCOMP (in core choice group with COMP1130)', () => {
      expect(isMandatoryForDegree('COMP1100', 'BCOMP')).toBe(true);
    });

    it('COMP1600 is NOT mandatory for AENGI', () => {
      expect(isMandatoryForDegree('COMP1600', 'AENGI')).toBe(false);
    });

    it('COMP1600 is mandatory for BCOMP (in core)', () => {
      expect(isMandatoryForDegree('COMP1600', 'BCOMP')).toBe(true);
    });

    it('MATH1014 is mandatory for AENGI but NOT for BCOMP', () => {
      expect(isMandatoryForDegree('MATH1014', 'AENGI')).toBe(true);
      expect(isMandatoryForDegree('MATH1014', 'BCOMP')).toBe(false);
    });

    it('returns false for unknown degree', () => {
      expect(isMandatoryForDegree('MATH1013', 'UNKNOWN')).toBe(false);
    });
  });

  describe('Shared Mandatory Courses', () => {
    it('identifies ENGN2219 as shared between AENGI and BCOMP', () => {
      expect(isSharedMandatory('ENGN2219', 'AENGI-BCOMP')).toBe(true);
    });

    it('identifies COMP2300 as shared between AENGI and BCOMP', () => {
      expect(isSharedMandatory('COMP2300', 'AENGI-BCOMP')).toBe(true);
    });

    it('COMP1100 is shared (mandatory for AENGI foundations, BCOMP core)', () => {
      expect(isSharedMandatory('COMP1100', 'AENGI-BCOMP')).toBe(true);
    });

    it('MATH1013 is NOT shared (mandatory for AENGI, but only a pool option for BCOMP)', () => {
      expect(isSharedMandatory('MATH1013', 'AENGI-BCOMP')).toBe(false);
    });

    it('MATH1014 is NOT shared (mandatory for AENGI but not in any BCOMP requirement)', () => {
      expect(isSharedMandatory('MATH1014', 'AENGI-BCOMP')).toBe(false);
    });

    it('COMP2100 is NOT shared (only core for BCOMP)', () => {
      expect(isSharedMandatory('COMP2100', 'AENGI-BCOMP')).toBe(false);
    });

    it('PHYS1101 is NOT shared (mandatory for AENGI but not listed in BCOMP)', () => {
      expect(isSharedMandatory('PHYS1101', 'AENGI-BCOMP')).toBe(false);
    });

    it('returns false for single degree programs', () => {
      expect(isSharedMandatory('COMP1100', 'AENGI')).toBe(false);
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

    it('MATH1013 is core for BCOMP (appears in ICT Related Course pool)', () => {
      // isCoreForDegree is intentionally broad — includes pool categories
      expect(isCoreForDegree('MATH1013', 'BCOMP')).toBe(true);
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

    it('COMP2300 defaults to both degrees (shared via equivalence)', () => {
      const attribution = getDefaultDegreeAttribution('COMP2300', 'AENGI-BCOMP');
      expect(attribution).toContain('AENGI');
      expect(attribution).toContain('BCOMP');
      expect(attribution.length).toBe(2);
    });

    it('MATH1013 defaults to AENGI only (not shared — pool option for BCOMP)', () => {
      const attribution = getDefaultDegreeAttribution('MATH1013', 'AENGI-BCOMP');
      expect(attribution).toEqual(['AENGI']);
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
