import { describe, it, expect, beforeEach } from 'bun:test';
import { usePlanStore } from '../src/store/planStore';

describe('Approved Credit', () => {
  beforeEach(() => {
    usePlanStore.setState({ plans: [], activePlanId: null });
  });

  it('registers approved course credit without placing it in a semester', () => {
    const store = usePlanStore.getState();
    const planId = store.createPlan('Approved Credit Plan', 2025, 1, 'AENGI');

    store.addApprovedCourseCredit(planId, 'COMP1100');

    const plan = usePlanStore.getState().getPlanById(planId);
    expect(plan).toBeDefined();
    expect(plan?.approvedCredits.length).toBe(1);
    expect(plan?.approvedCredits[0].kind).toBe('course');
    expect(plan?.approvedCredits[0].courseCode).toBe('COMP1100');
    expect(plan?.courses.length).toBe(0);
  });

  it('prevents adding a semester course that already exists as approved credit', () => {
    const store = usePlanStore.getState();
    const planId = store.createPlan('No Duplicate Credit', 2025, 1, 'AENGI');

    store.addApprovedCourseCredit(planId, 'COMP1100');
    store.addCourse(planId, 'COMP1100', 1, 1);

    const plan = usePlanStore.getState().getPlanById(planId);
    expect(plan?.approvedCredits.length).toBe(1);
    expect(plan?.courses.length).toBe(0);
  });

  it('uses approved course credit when evaluating prerequisites', () => {
    const store = usePlanStore.getState();
    const planId = store.createPlan('Prereq Credit', 2025, 1, 'AENGI');

    store.addApprovedCourseCredit(planId, 'COMP1100');

    const prereqsMet = usePlanStore.getState().getPrerequisitesMet(planId, 'COMP2100', 2, 1);
    expect(prereqsMet).toBe(true);
  });

  it('tracks unspecified school and level credit toward degree totals', () => {
    const store = usePlanStore.getState();
    const planId = store.createPlan('Unspecified Credit', 2025, 1, 'AENGI');

    store.addUnspecifiedCredit(planId, 'ENGN', 2000, 12);

    const progress = usePlanStore.getState().getCombinedDegreeProgress(planId);
    expect(progress).toBeTruthy();
    expect(progress?.primary.requirements.engnElectives.completed).toBe(12);
    expect(progress?.overallTotal.completed).toBe(12);
  });

  it('removes approved credit entries', () => {
    const store = usePlanStore.getState();
    const planId = store.createPlan('Remove Credit', 2025, 1, 'AENGI');

    store.addUnspecifiedCredit(planId, 'COMP', 3000, 6);
    const creditId = usePlanStore.getState().getPlanById(planId)?.approvedCredits[0]?.id;
    expect(creditId).toBeTruthy();

    if (creditId) {
      store.removeApprovedCredit(planId, creditId);
    }

    const plan = usePlanStore.getState().getPlanById(planId);
    expect(plan?.approvedCredits.length).toBe(0);
  });
});
