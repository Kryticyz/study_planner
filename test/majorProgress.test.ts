import { beforeEach, describe, expect, it } from 'bun:test';
import { usePlanStore } from '../src/store/planStore';

describe('Major Progress and Attribution', () => {
  beforeEach(() => {
    usePlanStore.setState({ plans: [], activePlanId: null });
  });

  it('hydrates the default engineering major when a plan is created', () => {
    const planId = usePlanStore.getState().createPlan('Engineering', 2025, 1, 'AENGI');

    const plan = usePlanStore.getState().getPlanById(planId);
    expect(plan?.selectedMajors?.AENGI).toBe('ELCO-MAJ');
  });

  it('updates major progress when the selected major changes', () => {
    const store = usePlanStore.getState();
    const planId = store.createPlan('Engineering', 2025, 1, 'AENGI');

    store.addCourse(planId, 'ENGN3539', 3, 1);

    const before = usePlanStore.getState().getCombinedDegreeProgress(planId);
    expect(before?.primary.selectedMajor?.code).toBe('ELCO-MAJ');
    expect(before?.primary.selectedMajor?.completed).toBe(6);

    store.setSelectedMajor(planId, 'AENGI', 'ASSY-MAJ');

    const after = usePlanStore.getState().getCombinedDegreeProgress(planId);
    expect(after?.primary.selectedMajor?.code).toBe('ASSY-MAJ');
    expect(after?.primary.selectedMajor?.completed).toBe(0);
  });

  it('allows approved credit attribution overrides in double degrees', () => {
    const store = usePlanStore.getState();
    const planId = store.createPlan('Double Degree', 2025, 1, 'AENGI-BCOMP');

    store.addUnspecifiedCredit(planId, 'COMP', 3000, 6);
    const creditId = usePlanStore.getState().getPlanById(planId)?.approvedCredits[0]?.id;

    expect(creditId).toBeTruthy();
    if (!creditId) return;

    store.setApprovedCreditCountingOverride(planId, creditId, ['BCOMP']);

    const progress = usePlanStore.getState().getCombinedDegreeProgress(planId);
    const row = progress?.attributionRows.find(entry => entry.id === `approved:${creditId}`);

    expect(row?.assignedDegreeCodes).toEqual(['BCOMP']);
    expect(row?.usedByDegreeCodes).toContain('BCOMP');
  });

  it('uses the program total for single-degree overall totals', () => {
    const planId = usePlanStore.getState().createPlan('Engineering', 2025, 1, 'AENGI');

    const progress = usePlanStore.getState().getCombinedDegreeProgress(planId);
    expect(progress?.overallTotal.required).toBe(192);
    expect(progress?.primary.total.required).toBe(192);
  });
});
