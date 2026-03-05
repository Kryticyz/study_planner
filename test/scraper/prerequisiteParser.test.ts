import { test, expect, describe } from 'bun:test';
import {
  parsePrerequisiteText,
  extractCourseCodes,
  filterSelfFromExpression,
} from '../../src/scraper/prerequisiteParser';
import type { PrerequisiteExpression } from '../../src/types/prerequisites';

describe('extractCourseCodes', () => {
  test('extracts single course code', () => {
    expect(extractCourseCodes('COMP1100')).toEqual(['COMP1100']);
  });

  test('extracts multiple course codes', () => {
    const codes = extractCourseCodes('COMP1100, MATH1013 and ENGN1211');
    expect(codes).toContain('COMP1100');
    expect(codes).toContain('MATH1013');
    expect(codes).toContain('ENGN1211');
  });

  test('deduplicates course codes', () => {
    const codes = extractCourseCodes('COMP1100 or COMP1100');
    expect(codes).toEqual(['COMP1100']);
  });

  test('returns empty for no codes', () => {
    expect(extractCourseCodes('no course codes here')).toEqual([]);
  });

  test('handles codes embedded in longer text', () => {
    const codes = extractCourseCodes(
      'To enrol in this course you must have completed ENGN1218'
    );
    expect(codes).toEqual(['ENGN1218']);
  });
});

describe('parsePrerequisiteText - Simple Prerequisites', () => {
  test('empty text returns empty result', () => {
    const result = parsePrerequisiteText('');
    expect(result.prerequisites).toEqual([]);
    expect(result.prerequisiteAlternatives).toEqual([]);
    expect(result.corequisites).toEqual([]);
    expect(result.incompatible).toEqual([]);
    expect(result.prerequisiteExpression).toBeNull();
  });

  test('single course prerequisite', () => {
    const result = parsePrerequisiteText(
      'To enrol in this course you must have completed ENGN1218'
    );
    expect(result.prerequisites).toContain('ENGN1218');
    expect(result.prerequisiteExpression).toEqual({
      type: 'course',
      courseCode: 'ENGN1218',
    });
  });

  test('single course with "successfully completed or be currently studying"', () => {
    const result = parsePrerequisiteText(
      'To enrol in this course you must have successfully completed or be currently studying COMP2100'
    );
    expect(result.prerequisites).toContain('COMP2100');
    expect(result.prerequisiteExpression).toEqual({
      type: 'course',
      courseCode: 'COMP2100',
    });
  });
});

describe('parsePrerequisiteText - AND Prerequisites', () => {
  test('two courses with AND', () => {
    const result = parsePrerequisiteText(
      'To enrol in this course you must have completed ENGN1218 AND MATH1013'
    );
    expect(result.prerequisites).toContain('ENGN1218');
    expect(result.prerequisites).toContain('MATH1013');
    expect(result.prerequisiteExpression?.type).toBe('and');
    if (result.prerequisiteExpression?.type === 'and') {
      expect(result.prerequisiteExpression.operands).toHaveLength(2);
    }
  });

  test('multiple courses with "and"', () => {
    const result = parsePrerequisiteText(
      'To enrol you must have completed ENGN1217, MATH1013 and PHYS1101'
    );
    // Should extract all three courses
    const allCodes = [
      ...result.prerequisites,
      ...result.prerequisiteAlternatives.flat(),
    ];
    expect(allCodes).toContain('ENGN1217');
    expect(allCodes).toContain('MATH1013');
    expect(allCodes).toContain('PHYS1101');
  });
});

describe('parsePrerequisiteText - OR Prerequisites', () => {
  test('two courses with OR', () => {
    const result = parsePrerequisiteText(
      'To enrol you must have completed COMP1100 OR COMP1130'
    );
    expect(result.prerequisiteExpression?.type).toBe('or');
    if (result.prerequisiteExpression?.type === 'or') {
      expect(result.prerequisiteExpression.operands).toHaveLength(2);
      expect(result.prerequisiteExpression.operands[0]).toEqual({
        type: 'course',
        courseCode: 'COMP1100',
      });
      expect(result.prerequisiteExpression.operands[1]).toEqual({
        type: 'course',
        courseCode: 'COMP1130',
      });
    }
    // Legacy field should have an alternatives group
    expect(result.prerequisiteAlternatives).toEqual([['COMP1100', 'COMP1130']]);
  });
});

describe('parsePrerequisiteText - Mixed AND/OR', () => {
  test('AND with nested OR using parentheses', () => {
    const result = parsePrerequisiteText(
      'ENGN2301 AND (COMP1100 OR COMP1130)'
    );
    expect(result.prerequisiteExpression?.type).toBe('and');
    if (result.prerequisiteExpression?.type === 'and') {
      const ops = result.prerequisiteExpression.operands;
      expect(ops[0]).toEqual({ type: 'course', courseCode: 'ENGN2301' });
      expect(ops[1]?.type).toBe('or');
    }
  });
});

describe('parsePrerequisiteText - Unit Level Requirements', () => {
  test('units of PREFIX coded courses', () => {
    const result = parsePrerequisiteText(
      '24 units of COMP coded courses AND (6 units of MATH OR COMP1600)'
    );
    expect(result.prerequisiteExpression?.type).toBe('and');
    if (result.prerequisiteExpression?.type === 'and') {
      const ops = result.prerequisiteExpression.operands;
      // First operand should be unitLevel
      expect(ops[0]?.type).toBe('unitLevel');
      if (ops[0]?.type === 'unitLevel') {
        expect(ops[0].minUnits).toBe(24);
        expect(ops[0].coursePrefix).toBe('COMP');
      }
    }
  });

  test('units at level or above', () => {
    const result = parsePrerequisiteText(
      '48 units at 2000 level or above'
    );
    expect(result.prerequisiteExpression?.type).toBe('unitLevel');
    if (result.prerequisiteExpression?.type === 'unitLevel') {
      expect(result.prerequisiteExpression.minUnits).toBe(48);
      expect(result.prerequisiteExpression.level).toBe(2000);
      expect(result.prerequisiteExpression.levelOperator).toBe('atLeast');
    }
  });

  test('units of PREFIX LEVEL/LEVEL courses', () => {
    const result = parsePrerequisiteText(
      '18 units of ENGN3000/4000 courses'
    );
    expect(result.prerequisiteExpression?.type).toBe('unitLevel');
    if (result.prerequisiteExpression?.type === 'unitLevel') {
      expect(result.prerequisiteExpression.minUnits).toBe(18);
      expect(result.prerequisiteExpression.coursePrefix).toBe('ENGN');
      expect(result.prerequisiteExpression.level).toBe(3000);
      expect(result.prerequisiteExpression.levelOperator).toBe('atLeast');
    }
  });
});

describe('parsePrerequisiteText - Incompatible Courses', () => {
  test('simple incompatible', () => {
    const result = parsePrerequisiteText(
      'Incompatible with COMP2130, COMP6120 and COMP6311'
    );
    expect(result.incompatible).toContain('COMP2130');
    expect(result.incompatible).toContain('COMP6120');
    expect(result.incompatible).toContain('COMP6311');
  });

  test('"not able to enrol if completed"', () => {
    const result = parsePrerequisiteText(
      'You are not able to enrol in this course if you have successfully completed COMP6466'
    );
    expect(result.incompatible).toContain('COMP6466');
  });

  test('"cannot enrol if completed"', () => {
    const result = parsePrerequisiteText(
      'You cannot enrol in this course if you have completed ENGN3221'
    );
    expect(result.incompatible).toContain('ENGN3221');
  });

  test('prerequisite with incompatible in same text', () => {
    const result = parsePrerequisiteText(
      'To enrol in this course you must have completed ENGN2301. You cannot enrol in this course if you have completed ENGN3221.'
    );
    expect(result.prerequisites).toContain('ENGN2301');
    expect(result.incompatible).toContain('ENGN3221');
  });
});

describe('parsePrerequisiteText - Corequisites', () => {
  test('co-requisite with colon', () => {
    const result = parsePrerequisiteText(
      'Co-requisite: MATH2305'
    );
    expect(result.corequisites).toContain('MATH2305');
  });

  test('corequisite without hyphen', () => {
    const result = parsePrerequisiteText(
      'Corequisite: MATH1013'
    );
    expect(result.corequisites).toContain('MATH1013');
  });
});

describe('parsePrerequisiteText - Real ANU Examples', () => {
  test('COMP2120 prerequisite', () => {
    const result = parsePrerequisiteText(
      'To enrol in this course you must have successfully completed or be currently studying COMP2100'
    );
    expect(result.prerequisites).toContain('COMP2100');
  });

  test('ENGN2218 prerequisite', () => {
    const result = parsePrerequisiteText(
      'To enrol in this course you must have completed ENGN1218'
    );
    expect(result.prerequisites).toContain('ENGN1218');
  });

  test('COMP3600 prerequisite (complex)', () => {
    const result = parsePrerequisiteText(
      '24 units of COMP coded courses AND (6 units of MATH OR COMP1600)'
    );
    expect(result.prerequisiteExpression?.type).toBe('and');
  });

  test('ENGN4300 prerequisite (complex)', () => {
    const result = parsePrerequisiteText(
      'To enrol in this course, you must have completed ENGN3300 and at least a further 18 units of ENGN3000/4000 courses.'
    );
    // Should find ENGN3300 as a prerequisite
    const allCodes = [
      ...result.prerequisites,
      ...result.prerequisiteAlternatives.flat(),
    ];
    expect(allCodes).toContain('ENGN3300');
    // Should have a unit level requirement for ENGN 3000/4000
    if (result.prerequisiteExpression?.type === 'and') {
      const hasUnitReq = result.prerequisiteExpression.operands.some(
        op => op.type === 'unitLevel'
      );
      expect(hasUnitReq).toBe(true);
    }
  });

  test('ENGN3300 prerequisite with incompatible', () => {
    const result = parsePrerequisiteText(
      'To enrol in this course you must have completed ENGN2301. You cannot enrol in this course if you have completed ENGN3221.'
    );
    expect(result.prerequisites).toContain('ENGN2301');
    expect(result.incompatible).toContain('ENGN3221');
  });
});

describe('filterSelfFromExpression', () => {
  test('removes self-reference from course expression', () => {
    const expr: PrerequisiteExpression = { type: 'course', courseCode: 'COMP1100' };
    expect(filterSelfFromExpression(expr, 'COMP1100')).toBeNull();
  });

  test('keeps non-self course expression', () => {
    const expr: PrerequisiteExpression = { type: 'course', courseCode: 'COMP1100' };
    expect(filterSelfFromExpression(expr, 'COMP2100')).toEqual(expr);
  });

  test('removes self from AND expression', () => {
    const expr: PrerequisiteExpression = {
      type: 'and',
      operands: [
        { type: 'course', courseCode: 'COMP1100' },
        { type: 'course', courseCode: 'COMP2100' },
      ],
    };
    const result = filterSelfFromExpression(expr, 'COMP1100');
    expect(result).toEqual({ type: 'course', courseCode: 'COMP2100' });
  });

  test('removes self from OR expression', () => {
    const expr: PrerequisiteExpression = {
      type: 'or',
      operands: [
        { type: 'course', courseCode: 'COMP1100' },
        { type: 'course', courseCode: 'COMP1130' },
      ],
    };
    const result = filterSelfFromExpression(expr, 'COMP1100');
    expect(result).toEqual({ type: 'course', courseCode: 'COMP1130' });
  });

  test('returns null for null input', () => {
    expect(filterSelfFromExpression(null, 'COMP1100')).toBeNull();
  });

  test('preserves unitLevel expressions', () => {
    const expr: PrerequisiteExpression = {
      type: 'unitLevel',
      minUnits: 24,
      level: 2000,
      levelOperator: 'atLeast',
    };
    expect(filterSelfFromExpression(expr, 'COMP1100')).toEqual(expr);
  });
});
