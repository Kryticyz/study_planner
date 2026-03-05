/**
 * Program page scraper for ANU Programs & Courses.
 * Extracts program structure, required courses, and major listings.
 */

import * as cheerio from 'cheerio';

export interface ScrapedProgram {
  code: string;
  name: string;
  totalUnits: number;
  duration: string;
  majors: string[];
  courseCodes: string[];
}

export interface ScrapedMajor {
  code: string;
  name: string;
  units: number;
  courseCodes: string[];
}

/**
 * Extract all course codes from a page's text and links.
 */
function extractAllCourseCodes($: cheerio.CheerioAPI): string[] {
  const codes = new Set<string>();

  // From links to course pages
  $('a[href*="/course/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(/\/course\/([A-Z]{4}\d{4})/);
    if (match) codes.add(match[1]);
  });

  // From text content
  const text = $.root().text();
  const matches = text.match(/\b[A-Z]{4}\d{4}\b/g);
  if (matches) {
    for (const code of matches) {
      codes.add(code);
    }
  }

  return [...codes].sort();
}

/**
 * Extract major/specialisation codes from a program page.
 */
function extractMajorCodes($: cheerio.CheerioAPI): string[] {
  const codes = new Set<string>();

  // Look for links to major pages: /major/CODE or /specialisation/CODE
  $('a[href*="/major/"], a[href*="/specialisation/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(/\/(?:major|specialisation)\/([A-Z]{4}-(?:MAJ|MIN|SPEC))/);
    if (match) codes.add(match[1]);
  });

  return [...codes].sort();
}

/**
 * Extract total units from the program page.
 */
function extractTotalUnits($: cheerio.CheerioAPI): number {
  const text = $.root().text();

  // Look for "192 units" or "144 units" in program overview
  const match = text.match(/(\d{2,3})\s+units?/i);
  if (match) return parseInt(match[1]);

  return 0;
}

/**
 * Extract program duration.
 */
function extractDuration($: cheerio.CheerioAPI): string {
  const text = $.root().text();
  const match = text.match(/(\d+)\s+year[s]?\s+full[- ]?time/i);
  if (match) return `${match[1]} year full-time`;
  return '';
}

/**
 * Scrape a program page and return program structure.
 */
export function scrapeProgram(html: string, code: string): ScrapedProgram {
  const $ = cheerio.load(html);

  // Extract program name from title tag or second h1 (first h1 is site name)
  let name = '';
  const titleTag = $('title');
  if (titleTag.length > 0) {
    // Title format: "Bachelor of Engineering (Honours) - ANU"
    name = titleTag.text().trim().replace(/\s*[-–]\s*ANU\s*$/, '');
  }
  if (!name) {
    const h1s = $('h1');
    // Skip first h1 if it's the site name "Programs and Courses"
    if (h1s.length > 1) {
      name = $(h1s[1]).text().trim();
    } else if (h1s.length > 0) {
      name = h1s.first().text().trim();
    }
  }
  // Clean up name - remove code prefix
  name = name.replace(new RegExp(`^${code}\\s*[-–:]?\\s*`, 'i'), '');

  return {
    code: code.toUpperCase(),
    name,
    totalUnits: extractTotalUnits($),
    duration: extractDuration($),
    majors: extractMajorCodes($),
    courseCodes: extractAllCourseCodes($),
  };
}

/**
 * Scrape a major/specialisation page.
 */
export function scrapeMajor(html: string, code: string): ScrapedMajor {
  const $ = cheerio.load(html);

  let name = '';
  const h1 = $('h1');
  if (h1.length > 0) {
    name = h1.first().text().trim();
  }

  const text = $.root().text();
  let units = 48; // Default for majors
  const unitsMatch = text.match(/(\d{2,3})\s+units?/i);
  if (unitsMatch) units = parseInt(unitsMatch[1]);

  return {
    code,
    name,
    units,
    courseCodes: extractAllCourseCodes($),
  };
}
