/**
 * ANU Course Scraper - Main entry point.
 *
 * Scrapes ANU Programs & Courses website to build a course database
 * compatible with the study planner application.
 *
 * Usage:
 *   bun src/scraper/index.ts <program_code> [options]
 *
 * Examples:
 *   bun src/scraper/index.ts aengi --year 2026 --output courses.json
 *   bun src/scraper/index.ts aacom --year 2026
 *   bun src/scraper/index.ts --courses COMP1100,COMP2100 --year 2026
 */

import * as fs from 'fs';
import { ANUFetcher, type FetcherOptions } from './fetcher';
import { scrapeCourse } from './courseScraper';
import { scrapeProgram, scrapeMajor } from './programScraper';
import type { Course } from '../types';

export interface ScrapeResult {
  metadata: {
    year: number;
    scrapedAt: string;
    programCode?: string;
  };
  program?: ReturnType<typeof scrapeProgram>;
  majors: ReturnType<typeof scrapeMajor>[];
  courses: Record<string, Course>;
  errors: string[];
}

export interface ScrapeOptions extends FetcherOptions {
  quiet?: boolean;
  skipPrereqCourses?: boolean;
}

function log(message: string, quiet: boolean) {
  if (!quiet) console.log(message);
}

/**
 * Scrape a full program and all its courses.
 */
export async function scrapeFullProgram(
  programCode: string,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  const quiet = options.quiet ?? false;
  const fetcher = new ANUFetcher(options);
  const year = options.year ?? 2026;

  const result: ScrapeResult = {
    metadata: {
      year,
      scrapedAt: new Date().toISOString(),
      programCode: programCode.toUpperCase(),
    },
    majors: [],
    courses: {},
    errors: [],
  };

  log(`Scraping program: ${programCode.toUpperCase()} (${year})`, quiet);

  // Step 1: Fetch and parse program page
  try {
    const programHTML = await fetcher.fetchProgram(programCode);
    result.program = scrapeProgram(programHTML, programCode);
    log(`  Program: ${result.program.name} (${result.program.totalUnits} units)`, quiet);
    log(`  Found ${result.program.courseCodes.length} course codes`, quiet);
    log(`  Found ${result.program.majors.length} majors/specialisations`, quiet);
  } catch (error) {
    const msg = `Failed to scrape program page: ${error}`;
    result.errors.push(msg);
    log(`  ERROR: ${msg}`, quiet);
    return result;
  }

  // Step 2: Fetch and parse major pages
  for (const majorCode of result.program!.majors) {
    try {
      const majorHTML = await fetcher.fetchMajor(majorCode);
      const major = scrapeMajor(majorHTML, majorCode);
      result.majors.push(major);
      log(`  Major: ${major.name} (${major.courseCodes.length} courses)`, quiet);
    } catch (error) {
      const msg = `Failed to scrape major ${majorCode}: ${error}`;
      result.errors.push(msg);
      log(`  WARNING: ${msg}`, quiet);
    }
  }

  // Step 3: Collect all course codes
  const allCodes = new Set<string>();

  // From program page
  for (const code of result.program!.courseCodes) {
    allCodes.add(code);
  }

  // From major pages
  for (const major of result.majors) {
    for (const code of major.courseCodes) {
      allCodes.add(code);
    }
  }

  log(`\nTotal unique course codes: ${allCodes.size}`, quiet);

  // Step 4: Scrape individual course pages
  const codesToScrape = [...allCodes].sort();
  let scraped = 0;
  let failed = 0;

  for (const code of codesToScrape) {
    try {
      const courseHTML = await fetcher.fetchCourse(code);
      const course = scrapeCourse(courseHTML, code);
      if (course) {
        result.courses[code] = course;
        scraped++;
      } else {
        result.errors.push(`Failed to parse course ${code}`);
        failed++;
      }
    } catch (error) {
      const msg = `Failed to fetch course ${code}: ${error}`;
      result.errors.push(msg);
      failed++;
    }

    if ((scraped + failed) % 10 === 0) {
      log(`  Progress: ${scraped + failed}/${codesToScrape.length}`, quiet);
    }
  }

  // Step 5: Optionally scrape prerequisite courses not yet in database
  if (!options.skipPrereqCourses) {
    let iteration = 0;
    const maxIterations = 5;

    while (iteration < maxIterations) {
      const missingCodes = new Set<string>();

      for (const course of Object.values(result.courses)) {
        // Extract course codes from prerequisiteExpression
        if (course.prerequisiteExpression) {
          const extractCodes = (expr: import('../types/prerequisites').PrerequisiteExpression): string[] => {
            switch (expr.type) {
              case 'course': return [expr.courseCode];
              case 'and':
              case 'or': return expr.operands.flatMap(extractCodes);
              case 'unitLevel': return [];
              default: return [];
            }
          };
          for (const prereq of extractCodes(course.prerequisiteExpression)) {
            if (!result.courses[prereq]) missingCodes.add(prereq);
          }
        }
        if (course.corequisites) {
          for (const coreq of course.corequisites) {
            if (!result.courses[coreq]) missingCodes.add(coreq);
          }
        }
      }

      if (missingCodes.size === 0) break;

      log(`\nIteration ${iteration + 1}: Fetching ${missingCodes.size} prerequisite courses`, quiet);

      for (const code of missingCodes) {
        try {
          const courseHTML = await fetcher.fetchCourse(code);
          const course = scrapeCourse(courseHTML, code);
          if (course) {
            result.courses[code] = course;
            scraped++;
          }
        } catch {
          // Silently skip - these are prerequisite courses from other programs
        }
      }

      iteration++;
    }
  }

  log(`\nDone: ${Object.keys(result.courses).length} courses scraped, ${result.errors.length} errors`, quiet);

  return result;
}

/**
 * Scrape specific courses by code.
 */
export async function scrapeCourses(
  codes: string[],
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  const quiet = options.quiet ?? false;
  const fetcher = new ANUFetcher(options);
  const year = options.year ?? 2026;

  const result: ScrapeResult = {
    metadata: {
      year,
      scrapedAt: new Date().toISOString(),
    },
    majors: [],
    courses: {},
    errors: [],
  };

  for (const code of codes) {
    try {
      const courseHTML = await fetcher.fetchCourse(code.toUpperCase());
      const course = scrapeCourse(courseHTML, code.toUpperCase());
      if (course) {
        result.courses[code.toUpperCase()] = course;
        log(`Scraped: ${course.code} - ${course.name}`, quiet);
      } else {
        result.errors.push(`Failed to parse course ${code}`);
      }
    } catch (error) {
      const msg = `Failed to fetch ${code}: ${error}`;
      result.errors.push(msg);
      log(`ERROR: ${msg}`, quiet);
    }
  }

  return result;
}

// Re-export sub-modules
export { scrapeCourse, extractCourseCodesFromHTML } from './courseScraper';
export { scrapeProgram, scrapeMajor } from './programScraper';
export { parsePrerequisiteText, extractCourseCodes, filterSelfFromExpression } from './prerequisiteParser';
export type { ParsedPrerequisites } from './prerequisiteParser';
export type { ScrapedProgram, ScrapedMajor } from './programScraper';
export { ANUFetcher } from './fetcher';

// CLI entry point
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: bun src/scraper/index.ts <program_code> [options]');
    console.log('       bun src/scraper/index.ts --courses CODE1,CODE2 [options]');
    console.log('');
    console.log('Options:');
    console.log('  --year YEAR       Academic year (default: 2026)');
    console.log('  --output FILE     Output JSON file');
    console.log('  --no-cache        Disable caching');
    console.log('  --quiet           Suppress progress output');
    process.exit(1);
  }

  const year = parseInt(args[args.indexOf('--year') + 1] || '2026');
  const output = args[args.indexOf('--output') + 1];
  const noCache = args.includes('--no-cache');
  const quiet = args.includes('--quiet');

  const options: ScrapeOptions = {
    year,
    useCache: !noCache,
    quiet,
  };

  let result: ScrapeResult;

  if (args.includes('--courses')) {
    const codesStr = args[args.indexOf('--courses') + 1];
    const codes = codesStr.split(',').map(c => c.trim());
    result = await scrapeCourses(codes, options);
  } else {
    const programCode = args[0];
    result = await scrapeFullProgram(programCode, options);
  }

  if (output) {
    fs.writeFileSync(output, JSON.stringify(result, null, 2));
    console.log(`Output written to ${output}`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}
