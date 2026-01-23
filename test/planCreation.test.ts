import { describe, it, expect, beforeEach } from 'bun:test';
import { usePlanStore } from '../src/store/planStore';

describe('Plan Creation', () => {
  beforeEach(() => {
    // Reset the store state before each test
    usePlanStore.setState({ plans: [], activePlanId: null });
  });

  describe('createPlan', () => {
    it('creates a single degree plan with correct defaults', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('Test Plan');

      const plan = store.getPlanById(planId);
      expect(plan).toBeDefined();
      expect(plan?.name).toBe('Test Plan');
      expect(plan?.program).toBe('AENGI'); // Default program
      expect(plan?.startYear).toBe(2025);
      expect(plan?.startSemester).toBe(1);
    });

    it('creates a plan with specified program', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('Double Degree Plan', 2025, 1, 'AENGI-BCOMP');

      const plan = store.getPlanById(planId);
      expect(plan).toBeDefined();
      expect(plan?.program).toBe('AENGI-BCOMP');
    });

    it('creates a plan starting in semester 2', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('Mid-Year Start', 2025, 2, 'AENGI');

      const plan = store.getPlanById(planId);
      expect(plan?.startSemester).toBe(2);
    });

    it('sets the plan as active when no other plans exist', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('First Plan');

      expect(usePlanStore.getState().activePlanId).toBe(planId);
    });

    it('creates plans with unique IDs', () => {
      const store = usePlanStore.getState();
      const id1 = store.createPlan('Plan 1');
      const id2 = store.createPlan('Plan 2');

      expect(id1).not.toBe(id2);
    });
  });

  describe('duplicatePlan', () => {
    it('duplicates a plan preserving the program', () => {
      const store = usePlanStore.getState();
      const originalId = store.createPlan('Original', 2025, 1, 'AENGI-BCOMP');

      const duplicateId = usePlanStore.getState().duplicatePlan(originalId);

      const duplicate = usePlanStore.getState().getPlanById(duplicateId);
      expect(duplicate).toBeDefined();
      expect(duplicate?.program).toBe('AENGI-BCOMP');
      expect(duplicate?.name).toBe('Original (Copy)');
    });

    it('duplicates plan courses', () => {
      const store = usePlanStore.getState();
      const originalId = store.createPlan('Original');
      usePlanStore.getState().addCourse(originalId, 'COMP1100', 1, 1);
      usePlanStore.getState().addCourse(originalId, 'MATH1013', 1, 1);

      const duplicateId = usePlanStore.getState().duplicatePlan(originalId);

      const duplicate = usePlanStore.getState().getPlanById(duplicateId);
      expect(duplicate?.courses.length).toBe(2);
    });
  });

  describe('getMaxYearForPlan', () => {
    it('returns 4 for single degree plans', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('Single Degree', 2025, 1, 'AENGI');

      const maxYear = usePlanStore.getState().getMaxYearForPlan(planId);
      expect(maxYear).toBe(4);
    });

    it('returns 6 for double degree plans', () => {
      const store = usePlanStore.getState();
      const planId = store.createPlan('Double Degree', 2025, 1, 'AENGI-BCOMP');

      const maxYear = usePlanStore.getState().getMaxYearForPlan(planId);
      expect(maxYear).toBe(6);
    });
  });
});
