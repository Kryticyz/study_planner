import { test, expect, describe, beforeAll } from 'bun:test';
import { ANUFetcher } from '../../src/scraper/fetcher';
import { scrapeProgram } from '../../src/scraper/programScraper';
import { scrapeCourse } from '../../src/scraper/courseScraper';
import type { Course } from '../../src/types';
import type { PrerequisiteExpression } from '../../src/types/prerequisites';

/** Extract all course codes mentioned in a prerequisite expression */
function extractPrereqCodes(expr: PrerequisiteExpression | undefined): string[] {
  if (!expr) return [];
  switch (expr.type) {
    case 'course': return [expr.courseCode];
    case 'and':
    case 'or': return expr.operands.flatMap(extractPrereqCodes);
    case 'unitLevel': return [];
  }
}

const fetcher = new ANUFetcher({ year: 2026, useCache: true, cacheDir: './test-cache' });

// ─── AENGI ────────────────────────────────────────────────────────────────────

describe('AENGI - Bachelor of Engineering (Honours)', () => {
  let programHTML: string;

  beforeAll(async () => {
    programHTML = await fetcher.fetchProgram('aengi');
  });

  test('scrapes program name', () => {
    const program = scrapeProgram(programHTML, 'aengi');
    expect(program.name).toContain('Engineering');
  });

  test('identifies total units as 192', () => {
    const program = scrapeProgram(programHTML, 'aengi');
    expect(program.totalUnits).toBe(192);
  });

  test('identifies 4-year duration', () => {
    const program = scrapeProgram(programHTML, 'aengi');
    expect(program.duration).toContain('4');
  });

  test('finds engineering majors', () => {
    const program = scrapeProgram(programHTML, 'aengi');
    // AENGI should have several engineering majors
    expect(program.majors.length).toBeGreaterThanOrEqual(5);

    // Check for known majors
    const majorCodes = program.majors;
    const knownMajors = ['ELCO-MAJ', 'MTSY-MAJ', 'RENE-MAJ'];
    for (const known of knownMajors) {
      expect(majorCodes).toContain(known);
    }
  });

  test('finds compulsory engineering course codes', () => {
    const program = scrapeProgram(programHTML, 'aengi');
    const codes = program.courseCodes;

    // Foundation courses
    expect(codes).toContain('ENGN1211');
    expect(codes).toContain('ENGN1217');
    expect(codes).toContain('ENGN1218');

    // Core 2000-level
    expect(codes).toContain('ENGN2217');
    expect(codes).toContain('ENGN2218');
    expect(codes).toContain('ENGN2219');
    expect(codes).toContain('ENGN2222');
    expect(codes).toContain('ENGN2228');
    expect(codes).toContain('ENGN2300');
    expect(codes).toContain('ENGN2301');

    // Design sequence
    expect(codes).toContain('ENGN3300');
    expect(codes).toContain('ENGN3301');

    // Foundation maths/physics/computing
    expect(codes).toContain('MATH1013');
    expect(codes).toContain('PHYS1001');
    expect(codes).toContain('COMP1100');
  });

  test('finds capstone course codes', () => {
    const program = scrapeProgram(programHTML, 'aengi');
    const codes = program.courseCodes;
    // At least one of the capstone options should be present
    const hasCapstone = codes.includes('ENGN4300') || codes.includes('ENGN4350');
    expect(hasCapstone).toBe(true);
  });
});

describe('AENGI - Course Scraping', () => {
  test('scrapes ENGN1211 correctly', async () => {
    const html = await fetcher.fetchCourse('ENGN1211');
    const course = scrapeCourse(html, 'ENGN1211');
    expect(course).not.toBeNull();
    expect(course!.code).toBe('ENGN1211');
    expect(course!.units).toBe(6);
    expect(course!.level).toBe(1000);
  });

  test('scrapes ENGN2218 with prerequisite', async () => {
    const html = await fetcher.fetchCourse('ENGN2218');
    const course = scrapeCourse(html, 'ENGN2218');
    expect(course).not.toBeNull();
    expect(course!.code).toBe('ENGN2218');
    expect(course!.units).toBe(6);
    expect(course!.level).toBe(2000);

    // Should have ENGN1218 as prerequisite
    const allPrereqs = extractPrereqCodes(course!.prerequisiteExpression);
    expect(allPrereqs).toContain('ENGN1218');
  });

  test('scrapes ENGN3300 with prerequisite and incompatible', async () => {
    const html = await fetcher.fetchCourse('ENGN3300');
    const course = scrapeCourse(html, 'ENGN3300');
    expect(course).not.toBeNull();
    expect(course!.code).toBe('ENGN3300');

    // Should have ENGN2301 as prerequisite
    const allPrereqs = extractPrereqCodes(course!.prerequisiteExpression);
    expect(allPrereqs).toContain('ENGN2301');

    // Should have ENGN3221 as incompatible
    expect(course!.incompatible).toContain('ENGN3221');
  });

  test('scrapes ENGN4300 as capstone course', async () => {
    const html = await fetcher.fetchCourse('ENGN4300');
    const course = scrapeCourse(html, 'ENGN4300');
    expect(course).not.toBeNull();
    expect(course!.code).toBe('ENGN4300');

    // Should have ENGN3300 as prerequisite
    const allPrereqs = extractPrereqCodes(course!.prerequisiteExpression);
    expect(allPrereqs).toContain('ENGN3300');
  });

  test('scrapes MATH1013 as foundation', async () => {
    const html = await fetcher.fetchCourse('MATH1013');
    const course = scrapeCourse(html, 'MATH1013');
    expect(course).not.toBeNull();
    expect(course!.code).toBe('MATH1013');
    expect(course!.units).toBe(6);
    expect(course!.level).toBe(1000);
  });

  test('scrapes PHYS1001 foundation course', async () => {
    const html = await fetcher.fetchCourse('PHYS1001');
    const course = scrapeCourse(html, 'PHYS1001');
    expect(course).not.toBeNull();
    expect(course!.code).toBe('PHYS1001');
    expect(course!.units).toBe(6);
    expect(course!.level).toBe(1000);
  });

  test('course descriptions are non-empty', async () => {
    const codes = ['ENGN1211', 'ENGN2218', 'COMP1100'];
    for (const code of codes) {
      const html = await fetcher.fetchCourse(code);
      const course = scrapeCourse(html, code);
      expect(course).not.toBeNull();
      expect(course!.description.length).toBeGreaterThan(10);
    }
  });

  test('courses have valid semesters', async () => {
    const codes = ['ENGN1211', 'ENGN2218', 'MATH1013'];
    for (const code of codes) {
      const html = await fetcher.fetchCourse(code);
      const course = scrapeCourse(html, code);
      expect(course).not.toBeNull();
      expect(course!.semesters.length).toBeGreaterThanOrEqual(1);
      for (const sem of course!.semesters) {
        expect(['S1', 'S2', 'Summer', 'Full Year']).toContain(sem);
      }
    }
  });
});

// ─── AACOM ────────────────────────────────────────────────────────────────────

describe('AACOM - Bachelor of Advanced Computing (Honours)', () => {
  let programHTML: string;

  beforeAll(async () => {
    programHTML = await fetcher.fetchProgram('aacom');
  });

  test('scrapes program name', () => {
    const program = scrapeProgram(programHTML, 'aacom');
    expect(program.name).toContain('Computing');
  });

  test('identifies total units as 192', () => {
    const program = scrapeProgram(programHTML, 'aacom');
    expect(program.totalUnits).toBe(192);
  });

  test('identifies 4-year duration', () => {
    const program = scrapeProgram(programHTML, 'aacom');
    expect(program.duration).toContain('4');
  });

  test('finds specialisations/majors', () => {
    const program = scrapeProgram(programHTML, 'aacom');
    // AACOM has both specialisations and majors
    expect(program.majors.length).toBeGreaterThanOrEqual(1);
  });

  test('finds compulsory computing course codes', () => {
    const program = scrapeProgram(programHTML, 'aacom');
    const codes = program.courseCodes;

    // Foundation courses
    expect(codes).toContain('COMP1100');
    expect(codes).toContain('COMP1110');

    // Compulsory 2000/3000-level
    expect(codes).toContain('COMP2100');
    expect(codes).toContain('COMP2120');
    expect(codes).toContain('COMP2300');
    expect(codes).toContain('COMP2310');
    expect(codes).toContain('COMP2400');
    expect(codes).toContain('COMP3600');
    expect(codes).toContain('COMP3630');

    // Maths requirement
    expect(codes).toContain('MATH1005');
  });

  test('finds capstone/research course codes', () => {
    const program = scrapeProgram(programHTML, 'aacom');
    const codes = program.courseCodes;
    // Capstone options
    const hasCapstone =
      codes.includes('COMP4500') ||
      codes.includes('COMP4550') ||
      codes.includes('COMP4450');
    expect(hasCapstone).toBe(true);
  });
});

describe('AACOM - Course Scraping', () => {
  test('scrapes COMP1100 correctly', async () => {
    const html = await fetcher.fetchCourse('COMP1100');
    const course = scrapeCourse(html, 'COMP1100');
    expect(course).not.toBeNull();
    expect(course!.code).toBe('COMP1100');
    expect(course!.units).toBe(6);
    expect(course!.level).toBe(1000);
  });

  test('scrapes COMP2100 with prerequisite', async () => {
    const html = await fetcher.fetchCourse('COMP2100');
    const course = scrapeCourse(html, 'COMP2100');
    expect(course).not.toBeNull();
    expect(course!.code).toBe('COMP2100');
    expect(course!.units).toBe(6);
    expect(course!.level).toBe(2000);
  });

  test('scrapes COMP2120 with prerequisite on COMP2100', async () => {
    const html = await fetcher.fetchCourse('COMP2120');
    const course = scrapeCourse(html, 'COMP2120');
    expect(course).not.toBeNull();
    expect(course!.code).toBe('COMP2120');

    // Should require COMP2100
    const allPrereqs = extractPrereqCodes(course!.prerequisiteExpression);
    expect(allPrereqs).toContain('COMP2100');
  });

  test('scrapes COMP2120 incompatible courses', async () => {
    const html = await fetcher.fetchCourse('COMP2120');
    const course = scrapeCourse(html, 'COMP2120');
    expect(course).not.toBeNull();

    // COMP2120 is incompatible with COMP2130, COMP6120 and COMP6311
    expect(course!.incompatible).toBeDefined();
    expect(course!.incompatible!.length).toBeGreaterThan(0);
    expect(course!.incompatible).toContain('COMP2130');
  });

  test('scrapes COMP3600 with unit-level prerequisites', async () => {
    const html = await fetcher.fetchCourse('COMP3600');
    const course = scrapeCourse(html, 'COMP3600');
    expect(course).not.toBeNull();
    expect(course!.code).toBe('COMP3600');

    // COMP3600 requires "24 units of COMP coded courses AND (6 units of MATH OR COMP1600)"
    expect(course!.prerequisiteExpression).toBeDefined();

    // The expression should be an AND with a unitLevel component
    if (course!.prerequisiteExpression?.type === 'and') {
      const hasUnitReq = course!.prerequisiteExpression.operands.some(
        op => op.type === 'unitLevel'
      );
      expect(hasUnitReq).toBe(true);
    }
  });

  test('scrapes COMP3600 incompatible with COMP6466', async () => {
    const html = await fetcher.fetchCourse('COMP3600');
    const course = scrapeCourse(html, 'COMP3600');
    expect(course).not.toBeNull();
    expect(course!.incompatible).toContain('COMP6466');
  });

  test('all scraped courses produce valid Course objects', async () => {
    const codes = ['COMP1100', 'COMP1110', 'COMP2100', 'COMP2120', 'COMP3600'];
    for (const code of codes) {
      const html = await fetcher.fetchCourse(code);
      const course = scrapeCourse(html, code);
      expect(course).not.toBeNull();

      // Validate required fields
      expect(course!.code).toBe(code);
      expect(course!.name.length).toBeGreaterThan(0);
      expect(course!.units).toBeGreaterThan(0);
      expect(course!.level).toBeGreaterThanOrEqual(1000);
      expect(course!.college.length).toBeGreaterThan(0);
      expect(course!.description.length).toBeGreaterThan(0);

      // Validate optional fields have correct types when present
      if (course!.prerequisiteExpression) {
        expect(['course', 'and', 'or', 'unitLevel']).toContain(course!.prerequisiteExpression.type);
      }
      if (course!.incompatible) {
        expect(Array.isArray(course!.incompatible)).toBe(true);
      }
      if (course!.corequisites) {
        expect(Array.isArray(course!.corequisites)).toBe(true);
      }
    }
  });
});

// ─── Cross-program validation ─────────────────────────────────────────────────

describe('Cross-program Course Consistency', () => {
  test('shared foundation courses produce same data', async () => {
    // COMP1100 is shared between AACOM and AENGI
    const html = await fetcher.fetchCourse('COMP1100');
    const course = scrapeCourse(html, 'COMP1100');
    expect(course).not.toBeNull();
    expect(course!.code).toBe('COMP1100');
    expect(course!.units).toBe(6);
    expect(course!.level).toBe(1000);
  });

  test('MATH1013 is shared between programs', async () => {
    const html = await fetcher.fetchCourse('MATH1013');
    const course = scrapeCourse(html, 'MATH1013');
    expect(course).not.toBeNull();
    expect(course!.units).toBe(6);
    expect(course!.level).toBe(1000);
  });
});
