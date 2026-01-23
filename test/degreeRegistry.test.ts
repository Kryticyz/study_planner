import { describe, it, expect } from 'bun:test';
import {
  getProgram,
  getDegree,
  getMaxYear,
  getTotalSemesters,
  isSharedMandatory,
  isCoreForDegree,
  getAvailablePrograms,
  getDefaultDegreeAttribution,
  canUseAsElective,
} from '../src/data/degreeRegistry';

describe('Degree Registry', () => {
  describe('getProgram', () => {
    it('returns single degree program config', () => {
      const program = getProgram('AENGI');
      expect(program).toBeDefined();
      expect(program?.name).toBe('Bachelor of Engineering (Honours)');
      expect(program?.isDoubleDegree).toBe(false);
      expect(program?.duration).toBe(8);
      expect(program?.totalUnits).toBe(192);
    });

    it('returns double degree program config', () => {
      const program = getProgram('AENGI-BCOMP');
      expect(program).toBeDefined();
      expect(program?.name).toBe('Bachelor of Engineering (Honours) / Bachelor of Computing');
      expect(program?.isDoubleDegree).toBe(true);
      expect(program?.duration).toBe(11);
      expect(program?.totalUnits).toBe(264);
      expect(program?.degreeComponents).toEqual(['AENGI', 'BCOMP']);
    });

    it('returns undefined for unknown program', () => {
      const program = getProgram('UNKNOWN');
      expect(program).toBeUndefined();
    });
  });

  describe('getDegree', () => {
    it('returns engineering degree config', () => {
      const degree = getDegree('AENGI');
      expect(degree).toBeDefined();
      expect(degree?.code).toBe('AENGI');
      expect(degree?.requirements).toBeDefined();
      expect(degree?.requirements.foundations).toBeDefined();
      expect(degree?.requirements.foundations.units).toBe(36);
    });

    it('returns computing degree config', () => {
      const degree = getDegree('BCOMP');
      expect(degree).toBeDefined();
      expect(degree?.code).toBe('BCOMP');
      expect(degree?.requirements.core).toBeDefined();
      expect(degree?.requirements.core.units).toBe(48);
    });

    it('returns undefined for unknown degree', () => {
      const degree = getDegree('UNKNOWN');
      expect(degree).toBeUndefined();
    });
  });

  describe('getMaxYear', () => {
    it('returns 4 years for single engineering degree', () => {
      expect(getMaxYear('AENGI')).toBe(4);
    });

    it('returns 6 years for 11-semester double degree', () => {
      // 11 semesters / 2 = 5.5, ceil = 6
      expect(getMaxYear('AENGI-BCOMP')).toBe(6);
    });

    it('returns 6 years for engineering/science double degree', () => {
      expect(getMaxYear('AENGI-BSC')).toBe(6);
    });

    it('returns default 4 years for unknown program', () => {
      expect(getMaxYear('UNKNOWN')).toBe(4);
    });
  });

  describe('getTotalSemesters', () => {
    it('returns 8 semesters for single degree', () => {
      expect(getTotalSemesters('AENGI')).toBe(8);
    });

    it('returns 11 semesters for double degree', () => {
      expect(getTotalSemesters('AENGI-BCOMP')).toBe(11);
    });

    it('returns default 8 for unknown program', () => {
      expect(getTotalSemesters('UNKNOWN')).toBe(8);
    });
  });

  describe('isSharedMandatory', () => {
    it('returns true for shared mandatory courses in double degree', () => {
      // ENGN2219 and COMP2300 are shared mandatory courses
      expect(isSharedMandatory('ENGN2219', 'AENGI-BCOMP')).toBe(true);
      expect(isSharedMandatory('COMP2300', 'AENGI-BCOMP')).toBe(true);
    });

    it('returns false for non-shared courses in double degree', () => {
      // COMP2100 is only in BCOMP
      expect(isSharedMandatory('COMP2400', 'AENGI-BCOMP')).toBe(false);
    });

    it('returns false for single degree programs', () => {
      expect(isSharedMandatory('COMP1100', 'AENGI')).toBe(false);
    });

    it('returns false for unknown program', () => {
      expect(isSharedMandatory('COMP1100', 'UNKNOWN')).toBe(false);
    });
  });

  describe('isCoreForDegree', () => {
    it('returns true for engineering foundation courses', () => {
      expect(isCoreForDegree('MATH1013', 'AENGI')).toBe(true);
      expect(isCoreForDegree('PHYS1101', 'AENGI')).toBe(true);
      expect(isCoreForDegree('ENGN1211', 'AENGI')).toBe(true);
    });

    it('returns true for computing core courses', () => {
      expect(isCoreForDegree('COMP1600', 'BCOMP')).toBe(true);
      expect(isCoreForDegree('COMP2100', 'BCOMP')).toBe(true);
    });

    it('returns true for choice group courses', () => {
      // COMP1100 or COMP1130 - both should be recognized
      expect(isCoreForDegree('COMP1100', 'BCOMP')).toBe(true);
      expect(isCoreForDegree('COMP1130', 'BCOMP')).toBe(true);
    });

    it('returns false for elective courses', () => {
      expect(isCoreForDegree('COMP3600', 'BCOMP')).toBe(false);
    });

    it('returns false for unknown degree', () => {
      expect(isCoreForDegree('COMP1100', 'UNKNOWN')).toBe(false);
    });
  });

  describe('getAvailablePrograms', () => {
    it('returns all available programs', () => {
      const programs = getAvailablePrograms();
      expect(programs.length).toBeGreaterThanOrEqual(3);
      expect(programs.some(p => p.code === 'AENGI')).toBe(true);
      expect(programs.some(p => p.code === 'AENGI-BCOMP')).toBe(true);
      expect(programs.some(p => p.code === 'AENGI-BSC')).toBe(true);
    });
  });

  describe('getDefaultDegreeAttribution', () => {
    it('uses manual override when provided', () => {
      const result = getDefaultDegreeAttribution('COMP1100', 'AENGI-BCOMP', ['BCOMP']);
      expect(result).toEqual(['BCOMP']);
    });

    it('returns both degrees for shared mandatory courses', () => {
      const result = getDefaultDegreeAttribution('ENGN2219', 'AENGI-BCOMP');
      expect(result).toContain('AENGI');
      expect(result).toContain('BCOMP');
    });

    it('returns single degree for single degree programs', () => {
      const result = getDefaultDegreeAttribution('COMP1100', 'AENGI');
      expect(result).toEqual(['AENGI']);
    });

    it('attributes core courses to the appropriate degree', () => {
      // COMP1600 is only core for BCOMP
      const result = getDefaultDegreeAttribution('COMP1600', 'AENGI-BCOMP');
      expect(result).toEqual(['BCOMP']);
    });
  });

  describe('canUseAsElective', () => {
    it('allows any course as elective for single degree', () => {
      expect(canUseAsElective('COMP3600', 'AENGI', 'AENGI')).toBe(true);
    });

    it('prevents core courses from another degree as elective in double degree', () => {
      // COMP1600 is core for BCOMP, cannot be elective for AENGI
      expect(canUseAsElective('COMP1600', 'AENGI', 'AENGI-BCOMP')).toBe(false);
    });

    it('allows non-core courses as electives in double degree', () => {
      // A random course not core to either degree
      expect(canUseAsElective('COMP3600', 'AENGI', 'AENGI-BCOMP')).toBe(true);
    });
  });
});
