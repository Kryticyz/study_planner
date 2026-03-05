/**
 * Natural language prerequisite parser for ANU course pages.
 *
 * Handles the varied natural language formats used by ANU to describe
 * course prerequisites, corequisites, and incompatibilities.
 *
 * Common patterns:
 *   "To enrol in this course you must have completed ENGN1218"
 *   "To enrol in this course you must have successfully completed or be currently studying COMP2100"
 *   "24 units of COMP coded courses AND (6 units of MATH OR COMP1600)"
 *   "Incompatible with COMP2130, COMP6120 and COMP6311"
 *   "You are not able to enrol in this course if you have successfully completed COMP6466"
 *   "Co-requisite: MATH2305"
 */

import { PrerequisiteExpression } from '../types/prerequisites';

const COURSE_CODE_RE = /\b[A-Z]{4}\d{4}\b/g;

export interface ParsedPrerequisites {
  prerequisites: string[];
  prerequisiteAlternatives: string[][];
  corequisites: string[];
  incompatible: string[];
  prerequisiteExpression: PrerequisiteExpression | null;
  rawText: string;
}

export function extractCourseCodes(text: string): string[] {
  const matches = text.match(COURSE_CODE_RE);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Split prerequisite text into semantic sections:
 * - prerequisite section(s)
 * - incompatibility section(s)
 * - corequisite section(s)
 */
function splitSections(text: string): {
  prerequisiteText: string;
  incompatibleText: string;
  corequisiteText: string;
} {
  let prerequisiteText = '';
  let incompatibleText = '';
  let corequisiteText = '';

  // Normalize whitespace
  const normalized = text.replace(/\s+/g, ' ').trim();

  // Split on sentence boundaries that indicate section changes
  // Process incompatible sections
  const incompatPatterns = [
    /(?:you (?:are|will) not (?:be )?able to enrol.*?if .*?(?:completed|completing))(.*?)(?:\.|$)/gi,
    /(?:incompatible with)(.*?)(?:\.|$)/gi,
    /(?:you cannot enrol.*?if .*?(?:completed|completing))(.*?)(?:\.|$)/gi,
    /(?:not available.*?if.*?completed)(.*?)(?:\.|$)/gi,
  ];

  let workingText = normalized;

  for (const pattern of incompatPatterns) {
    let match;
    while ((match = pattern.exec(normalized)) !== null) {
      incompatibleText += ' ' + match[1];
      // Remove matched section from working text
      workingText = workingText.replace(match[0], ' ');
    }
  }

  // Process corequisite sections
  const coreqPatterns = [
    /(?:co-?requisite[s]?\s*:?\s*)(.*?)(?:\.|$)/gi,
    /(?:must be (?:concurrently|simultaneously) (?:enrolled|studying).*?)(.*?)(?:\.|$)/gi,
  ];

  for (const pattern of coreqPatterns) {
    let match;
    while ((match = pattern.exec(normalized)) !== null) {
      corequisiteText += ' ' + match[1];
      workingText = workingText.replace(match[0], ' ');
    }
  }

  prerequisiteText = workingText.trim();

  return {
    prerequisiteText: prerequisiteText.trim(),
    incompatibleText: incompatibleText.trim(),
    corequisiteText: corequisiteText.trim(),
  };
}

/**
 * Parse a unit-level requirement from text.
 * Handles patterns like:
 *   "24 units of COMP coded courses"
 *   "48 units at 2000 level or above"
 *   "18 units of ENGN3000/4000 courses"
 *   "6 units of MATH"
 *   "24 units of COMP coded courses"
 */
function parseUnitRequirement(text: string): { expr: PrerequisiteExpression; matchLength: number } | null {
  let match: RegExpMatchArray | null;

  // Order matters: most specific patterns first

  // "N units of PREFIX LEVEL/LEVEL courses" e.g. "18 units of ENGN3000/4000 courses"
  match = text.match(
    /^(\d+)\s+units?\s+(?:of\s+)?(?:a\s+further\s+)?([A-Z]{4})\s*(\d{4})\/(\d{4})\s*(?:courses?)?/i
  );
  if (match) {
    const level = Math.min(parseInt(match[3]), parseInt(match[4]));
    return {
      expr: {
        type: 'unitLevel',
        minUnits: parseInt(match[1]),
        level: level,
        levelOperator: 'atLeast',
        coursePrefix: match[2].toUpperCase(),
      },
      matchLength: match[0].length,
    };
  }

  // "N units of PREFIX LEVEL+ courses" e.g. "12 units of ENGN 2000+ courses"
  match = text.match(
    /^(\d+)\s+units?\s+(?:of\s+)?([A-Z]{4})\s*(\d{4})\+\s*(?:courses?)?/i
  );
  if (match) {
    return {
      expr: {
        type: 'unitLevel',
        minUnits: parseInt(match[1]),
        level: parseInt(match[3]),
        levelOperator: 'atLeast',
        coursePrefix: match[2].toUpperCase(),
      },
      matchLength: match[0].length,
    };
  }

  // "N units at LEVEL level or above/higher"
  match = text.match(
    /^(\d+)\s+units?\s+(?:at\s+)?(\d{4})[\s-]?level\s+(?:or\s+)?(?:above|higher)/i
  );
  if (match) {
    return {
      expr: {
        type: 'unitLevel',
        minUnits: parseInt(match[1]),
        level: parseInt(match[2]),
        levelOperator: 'atLeast',
      },
      matchLength: match[0].length,
    };
  }

  // "N units of LEVEL-level courses"
  match = text.match(
    /^(\d+)\s+units?\s+(?:of\s+)?(\d{4})[\s-]?level\s+(?:courses?)?/i
  );
  if (match) {
    return {
      expr: {
        type: 'unitLevel',
        minUnits: parseInt(match[1]),
        level: parseInt(match[2]),
        levelOperator: 'exact',
      },
      matchLength: match[0].length,
    };
  }

  // "N units of PREFIX coded courses" or "N units of PREFIX" (must NOT be followed by a digit, to avoid matching "ENGN3000")
  match = text.match(
    /^(\d+)\s+units?\s+(?:of\s+)?([A-Z]{4})[\s-]?(?:coded\s+)?(?:courses?)?/i
  );
  if (match) {
    // Make sure the PREFIX isn't followed by digits (which would mean it's ENGN3000 not ENGN)
    const afterMatch = text.slice(match[0].length);
    if (/^\d/.test(afterMatch.trim())) {
      // This is actually a PREFIX+LEVEL pattern not caught above, skip
      return null;
    }
    return {
      expr: {
        type: 'unitLevel',
        minUnits: parseInt(match[1]),
        level: 0,
        levelOperator: 'atLeast',
        coursePrefix: match[2].toUpperCase(),
      },
      matchLength: match[0].length,
    };
  }

  return null;
}

/**
 * Tokenize the prerequisite text into a structured form for parsing.
 * Identifies course codes, unit requirements, AND/OR operators, and parentheses.
 */
type Token =
  | { type: 'course'; code: string }
  | { type: 'unitReq'; expr: PrerequisiteExpression }
  | { type: 'and' }
  | { type: 'or' }
  | { type: 'lparen' }
  | { type: 'rparen' };

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];

  // Pre-process: strip common preamble text
  let cleaned = text
    .replace(/to\s+enrol\s+in\s+this\s+course,?\s+you\s+must\s*:?\s*/gi, '')
    .replace(/have\s+(?:successfully\s+)?completed\s+(?:or\s+be\s+currently\s+(?:enrolled\s+in|studying)\s+)?/gi, '')
    .replace(/have\s+completed\s+(?:or\s+be\s+currently\s+(?:enrolled\s+in|studying)\s+)?/gi, '')
    .replace(/be\s+currently\s+(?:enrolled\s+in|studying)\s+/gi, '')
    .replace(/at\s+least\s+/gi, '')
    .replace(/a\s+further\s+/gi, '')
    .trim();

  // Scan through the text left-to-right
  let pos = 0;
  while (pos < cleaned.length) {
    // Skip whitespace
    if (/\s/.test(cleaned[pos])) {
      pos++;
      continue;
    }

    // Parentheses
    if (cleaned[pos] === '(') {
      tokens.push({ type: 'lparen' });
      pos++;
      continue;
    }
    if (cleaned[pos] === ')') {
      tokens.push({ type: 'rparen' });
      pos++;
      continue;
    }

    // Try to match a unit requirement starting at this position
    const remaining = cleaned.slice(pos);
    const unitResult = parseUnitRequirement(remaining);
    if (unitResult) {
      tokens.push({ type: 'unitReq', expr: unitResult.expr });
      pos += unitResult.matchLength;
      continue;
    }

    // Try to match a course code, but NOT if it's part of a LEVEL/LEVEL pattern like ENGN3000/4000
    const courseMatch = remaining.match(/^([A-Z]{4}\d{4})/);
    if (courseMatch) {
      // Check if this is part of a level range pattern (e.g. "ENGN3000/4000")
      const afterCode = remaining.slice(courseMatch[0].length);
      if (/^\s*\/\s*\d{4}/.test(afterCode)) {
        // This is a level range like ENGN3000/4000, skip it entirely
        // (it should have been captured by a unit requirement before this)
        pos += courseMatch[0].length;
        // Also skip the /LEVEL part
        const slashMatch = afterCode.match(/^\s*\/\s*\d{4}/);
        if (slashMatch) pos += slashMatch[0].length;
        continue;
      }
      tokens.push({ type: 'course', code: courseMatch[1] });
      pos += courseMatch[0].length;
      continue;
    }

    // Try to match AND/OR operators
    const andMatch = remaining.match(/^(?:AND|&)\b/i);
    if (andMatch) {
      tokens.push({ type: 'and' });
      pos += andMatch[0].length;
      continue;
    }

    const orMatch = remaining.match(/^OR\b/i);
    if (orMatch) {
      tokens.push({ type: 'or' });
      pos += orMatch[0].length;
      continue;
    }

    // Skip commas and other punctuation that serve as AND
    if (cleaned[pos] === ',') {
      // Comma between course codes acts as AND (or separator in a list)
      // We'll handle this context-sensitively later
      pos++;
      continue;
    }

    // Skip other characters
    pos++;
  }

  return tokens;
}

/**
 * Parse tokens into a PrerequisiteExpression tree.
 * Uses a simple recursive descent parser.
 *
 * Grammar:
 *   expr     → andExpr (OR andExpr)*
 *   andExpr  → atom (AND atom)*
 *   atom     → course | unitReq | '(' expr ')'
 *
 * Commas in a list like "A, B, and C" are treated as AND.
 * "A or B" is treated as OR.
 */
function parseTokens(tokens: Token[]): PrerequisiteExpression | null {
  if (tokens.length === 0) return null;

  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }

  function advance(): Token {
    return tokens[pos++];
  }

  function parseAtom(): PrerequisiteExpression | null {
    const tok = peek();
    if (!tok) return null;

    if (tok.type === 'course') {
      advance();
      return { type: 'course', courseCode: tok.code };
    }

    if (tok.type === 'unitReq') {
      advance();
      return tok.expr;
    }

    if (tok.type === 'lparen') {
      advance(); // consume '('
      const expr = parseOrExpr();
      if (peek()?.type === 'rparen') {
        advance(); // consume ')'
      }
      return expr;
    }

    return null;
  }

  function parseAndExpr(): PrerequisiteExpression | null {
    const left = parseAtom();
    if (!left) return null;

    const operands: PrerequisiteExpression[] = [left];

    while (pos < tokens.length) {
      const tok = peek();
      if (tok?.type === 'and') {
        advance();
        const right = parseAtom();
        if (right) operands.push(right);
      } else if (tok?.type === 'course' || tok?.type === 'unitReq' || tok?.type === 'lparen') {
        // Implicit AND: adjacent items without an explicit operator
        // But only if the next-next token is not 'or' (in which case it belongs to an OR chain)
        if (tokens[pos + 1]?.type === 'or') break;
        const right = parseAtom();
        if (right) operands.push(right);
      } else {
        break;
      }
    }

    if (operands.length === 1) return operands[0];
    return { type: 'and', operands };
  }

  function parseOrExpr(): PrerequisiteExpression | null {
    const left = parseAndExpr();
    if (!left) return null;

    const operands: PrerequisiteExpression[] = [left];

    while (pos < tokens.length && peek()?.type === 'or') {
      advance(); // consume 'or'
      const right = parseAndExpr();
      if (right) operands.push(right);
    }

    if (operands.length === 1) return operands[0];
    return { type: 'or', operands };
  }

  const result = parseOrExpr();
  return result;
}

/**
 * Flatten a prerequisite expression tree to extract simple lists
 * for the legacy prerequisites/prerequisiteAlternatives fields.
 */
function flattenToLegacy(
  expr: PrerequisiteExpression
): { prerequisites: string[]; prerequisiteAlternatives: string[][] } {
  const prerequisites: string[] = [];
  const prerequisiteAlternatives: string[][] = [];

  function visit(node: PrerequisiteExpression): void {
    switch (node.type) {
      case 'course':
        prerequisites.push(node.courseCode);
        break;
      case 'and':
        for (const op of node.operands) {
          if (op.type === 'or') {
            // This OR group becomes a prerequisiteAlternative
            const alts: string[] = [];
            for (const orOp of op.operands) {
              if (orOp.type === 'course') {
                alts.push(orOp.courseCode);
              }
            }
            if (alts.length > 0) {
              prerequisiteAlternatives.push(alts);
            }
            // Still recurse for non-course operands
            for (const orOp of op.operands) {
              if (orOp.type !== 'course') visit(orOp);
            }
          } else {
            visit(op);
          }
        }
        break;
      case 'or':
        // Top-level OR becomes a prerequisiteAlternative
        const alts: string[] = [];
        for (const op of node.operands) {
          if (op.type === 'course') {
            alts.push(op.courseCode);
          }
        }
        if (alts.length > 0) {
          prerequisiteAlternatives.push(alts);
        }
        break;
      case 'unitLevel':
        // Unit level requirements don't produce legacy prerequisites
        break;
    }
  }

  visit(expr);

  // Deduplicate prerequisites
  const uniquePrereqs = [...new Set(prerequisites)];

  return {
    prerequisites: uniquePrereqs,
    prerequisiteAlternatives,
  };
}

/**
 * Main entry point: parse natural language prerequisite text into structured data.
 */
export function parsePrerequisiteText(text: string): ParsedPrerequisites {
  const result: ParsedPrerequisites = {
    prerequisites: [],
    prerequisiteAlternatives: [],
    corequisites: [],
    incompatible: [],
    prerequisiteExpression: null,
    rawText: text,
  };

  if (!text || text.trim().length === 0) {
    return result;
  }

  const { prerequisiteText, incompatibleText, corequisiteText } = splitSections(text);

  // Extract incompatible courses
  result.incompatible = extractCourseCodes(incompatibleText);

  // Extract corequisites
  result.corequisites = extractCourseCodes(corequisiteText);

  // Parse prerequisites
  if (prerequisiteText) {
    const tokens = tokenize(prerequisiteText);
    const expr = parseTokens(tokens);

    if (expr) {
      result.prerequisiteExpression = expr;

      // Also populate legacy fields
      const legacy = flattenToLegacy(expr);
      result.prerequisites = legacy.prerequisites;
      result.prerequisiteAlternatives = legacy.prerequisiteAlternatives;
    }
  }

  return result;
}

/**
 * Remove self-references from a prerequisite expression tree.
 */
export function filterSelfFromExpression(
  expr: PrerequisiteExpression | null,
  selfCode: string
): PrerequisiteExpression | null {
  if (!expr) return null;

  switch (expr.type) {
    case 'course':
      return expr.courseCode === selfCode ? null : expr;

    case 'and':
    case 'or': {
      const filtered = expr.operands
        .map(op => filterSelfFromExpression(op, selfCode))
        .filter((op): op is PrerequisiteExpression => op !== null);

      if (filtered.length === 0) return null;
      if (filtered.length === 1) return filtered[0];
      return { type: expr.type, operands: filtered };
    }

    case 'unitLevel':
      return expr;
  }
}
