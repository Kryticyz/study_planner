/**
 * Course page scraper for ANU Programs & Courses.
 * Extracts structured course data from individual course pages.
 */

import * as cheerio from 'cheerio';
import type { Course, Semester } from '../types';
import { parsePrerequisiteText, filterSelfFromExpression } from './prerequisiteParser';


const SEMESTER_PATTERNS: Record<string, Semester> = {
  'first semester': 'S1',
  'semester 1': 'S1',
  'second semester': 'S2',
  'semester 2': 'S2',
  'summer': 'Summer',
  'summer session': 'Summer',
  'full year': 'Full Year',
  'full-year': 'Full Year',
};

function extractLevel(code: string): number {
  const match = code.match(/[A-Z]{4}(\d)\d{3}/);
  return match ? parseInt(match[1]) * 1000 : 1000;
}

function extractCollege(code: string): string {
  const prefix = code.slice(0, 4);
  const collegeMap: Record<string, string> = {
    ENGN: 'Engineering',
    MATH: 'Science',
    PHYS: 'Science',
    COMP: 'Computing',
    STAT: 'Science',
    CHEM: 'Science',
    BIOL: 'Science',
    ECON: 'Business',
    LAWS: 'Law',
    POLS: 'Arts',
    INFS: 'Computing',
  };
  return collegeMap[prefix] ?? 'Unknown';
}

function parseSemesters(text: string): Semester[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const semesters: Semester[] = [];

  for (const [pattern, code] of Object.entries(SEMESTER_PATTERNS)) {
    if (lower.includes(pattern) && !semesters.includes(code)) {
      semesters.push(code);
    }
  }

  return semesters;
}

/**
 * Extract the offered-in text from the page, checking multiple locations.
 */
function extractOfferedText($: cheerio.CheerioAPI): string {
  // Method 1: Look for "Offered in" in the sidebar/info section
  const allText = $.root().text();
  const offeredMatch = allText.match(/Offered\s+in\s*\n?\s*([^\n]+(?:\n[^\n*]+)?)/i);
  if (offeredMatch) return offeredMatch[1];

  // Method 2: Look for semester information in class descriptions
  const classElements = $('[class*="offered"], [class*="semester"]');
  if (classElements.length > 0) {
    return classElements.first().text();
  }

  // Method 3: Search for year-semester patterns in the text
  const yearSemMatch = allText.match(/\d{4}\s+(First|Second)\s+Semester/gi);
  if (yearSemMatch) return yearSemMatch.join(', ');

  return '';
}

/**
 * Extract prerequisite/requisite text from the page.
 */
function extractRequisiteText($: cheerio.CheerioAPI): string {
  // Method 1: Look for the requisite div (ANU uses <div class="requisite">)
  const requisiteDiv = $('div.requisite');
  if (requisiteDiv.length > 0) {
    return requisiteDiv.text().trim();
  }

  // Method 2: Look for "Requisite" section heading and grab content after it
  const allText = $.root().text();
  const reqMatch = allText.match(
    /Requisite\s+and\s+Incompatibility[^\n]*\n(.*?)(?:Prescribed\s+Texts|Other\s+Information|Workload|Assessment|$)/is
  );
  if (reqMatch) return reqMatch[1].trim();

  // Method 3: Look for prerequisite-like text in any section
  const prereqMatch = allText.match(
    /(?:To enrol in this course.*?(?:\.|$))/i
  );
  if (prereqMatch) return prereqMatch[0];

  return '';
}

/**
 * Extract field value from sidebar-style info sections.
 */
function extractSidebarField($: cheerio.CheerioAPI, fieldName: string): string | null {
  const allText = $.root().text();

  // Pattern: "FieldName\nValue" or "FieldName Value"
  const patterns = [
    new RegExp(`${fieldName}\\s*\\n\\s*([^\\n*]+)`, 'i'),
    new RegExp(`${fieldName}\\s+([^\\n*]+)`, 'i'),
    new RegExp(`\\*\\s*${fieldName}\\s+([^\\n*]+)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = allText.match(pattern);
    if (match) {
      return match[1].replace(/\s+/g, ' ').trim();
    }
  }

  // Look in list items
  const items = $('li');
  for (let i = 0; i < items.length; i++) {
    const text = $(items[i]).text().trim();
    if (text.toLowerCase().includes(fieldName.toLowerCase())) {
      const parts = text.split(new RegExp(fieldName, 'i'));
      if (parts.length > 1) return parts[1].trim();
    }
  }

  return null;
}

/**
 * Scrape a single course page and return a Course object.
 */
export function scrapeCourse(html: string, code: string): Course | null {
  try {
    const $ = cheerio.load(html);

    // Extract course name
    let name = '';
    const nameMeta = $('meta[name="course-name"]');
    if (nameMeta.length > 0) {
      name = nameMeta.attr('content')?.trim() ?? '';
    }
    if (!name) {
      const h1 = $('h1');
      name = h1.first().text().trim();
    }
    // Remove code prefix from name
    name = name.replace(new RegExp(`^${code}\\s*[-–:]?\\s*`), '');
    if (!name) name = code;

    // Extract units
    let units = 6;
    const unitsText = extractSidebarField($, 'Unit');
    if (unitsText) {
      const match = unitsText.match(/(\d+)/);
      if (match) units = parseInt(match[1]);
    }

    // Extract level and college
    const level = extractLevel(code);
    const college = extractCollege(code);

    // Extract semesters
    const offeredText = extractOfferedText($);
    const semesters = parseSemesters(offeredText);

    // Extract description
    let description = '';
    const descMeta = $('meta[name="course-description"]');
    if (descMeta.length > 0) {
      const descContent = descMeta.attr('content') ?? '';
      // Parse any HTML in the description
      const descDoc = cheerio.load(descContent);
      description = descDoc.root().text().trim();
    }
    if (!description) {
      // Fallback: look for first substantial paragraph
      $('p').each((_, el) => {
        if (description) return;
        const text = $(el).text().trim();
        if (text.length > 50) {
          description = text;
        }
      });
    }
    if (!description) description = `Course ${code}`;
    // Truncate
    if (description.length > 500) {
      description = description.slice(0, 497) + '...';
    }

    // Extract and parse prerequisites
    const requisiteText = extractRequisiteText($);
    const parsed = parsePrerequisiteText(requisiteText);

    // Filter self-references
    const prerequisiteExpression = filterSelfFromExpression(
      parsed.prerequisiteExpression,
      code
    );

    // Build course object
    const course: Course = {
      code,
      name,
      units,
      level,
      college,
      semesters,
      description,
    };

    if (parsed.corequisites.length > 0) {
      course.corequisites = parsed.corequisites;
    }

    if (parsed.incompatible.length > 0) {
      course.incompatible = parsed.incompatible;
    }

    if (prerequisiteExpression) {
      course.prerequisiteExpression = prerequisiteExpression;
    }

    if (semesters.includes('Full Year') || units === 12) {
      course.semesterSpan = 2;
    }

    return course;
  } catch (error) {
    console.error(`Error scraping course ${code}:`, error);
    return null;
  }
}

/**
 * Extract all course codes mentioned in an HTML page.
 */
export function extractCourseCodesFromHTML(html: string): string[] {
  const $ = cheerio.load(html);
  const text = $.root().text();
  const matches = text.match(/\b[A-Z]{4}\d{4}\b/g);
  return matches ? [...new Set(matches)] : [];
}
