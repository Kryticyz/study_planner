import { DegreeConfig, ProgramConfig } from '../types';

/**
 * Registry of individual degree configurations
 * Each degree defines its own requirements independently
 */
export const degreeConfigs: Record<string, DegreeConfig> = {
  'AENGI': {
    code: 'AENGI',
    name: 'Bachelor of Engineering (Honours)',
    totalUnits: 192,
    duration: 8, // 4 years = 8 semesters
    requirements: {
      foundations: {
        name: 'Foundations',
        description: 'First-year mathematics, physics, computing, introductory engineering',
        units: 36,
        courses: ['MATH1013', 'MATH1014', 'PHYS1101', 'COMP1100', 'ENGN1211', 'ENGN1217', 'ENGN1218'],
      },
      engineeringFundamentals: {
        name: 'Engineering Fundamentals',
        description: 'Second-year core engineering courses',
        units: 36,
        courses: ['ENGN2217', 'ENGN2218', 'ENGN2219', 'ENGN2222', 'ENGN2228'],
      },
      professionalCore: {
        name: 'Professional Core',
        description: 'Systems engineering and design sequence',
        units: 24,
        courses: ['ENGN2300', 'ENGN2301', 'ENGN3300', 'ENGN3301'],
      },
      major: {
        name: 'Major',
        description: 'Discipline specialization (Electronic and Communications Systems)',
        units: 48,
        courses: [
          'ENGN1218', 'ENGN2218', 'ENGN2228',
          'ENGN3226', 'ENGN3539',
          'ENGN4213', 'ENGN4536', 'ENGN4537', 'ENGN4625',
        ],
      },
      capstone: {
        name: 'Capstone',
        description: 'Final year project',
        units: 12,
        courses: ['ENGN4300'],
      },
      engnElectives: {
        name: 'Engineering Electives',
        description: '24 units of ENGN-coded electives',
        units: 24,
        prefixRequirements: [{ prefix: 'ENGN', minUnits: 24 }],
      },
      universityElectives: {
        name: 'University Electives',
        description: '24 units from any college',
        units: 24,
      },
    },
    sharedMandatoryCourses: ['ENGN2219', 'COMP2300', 'MATH1013', 'MATH1014', 'COMP1100'],
  },

  'BCOMP': {
    code: 'BCOMP',
    name: 'Bachelor of Computing',
    totalUnits: 144,
    duration: 6, // 3 years = 6 semesters (standalone)
    requirements: {
      core: {
        name: 'Computing Core',
        description: 'Core computing requirements',
        units: 48,
        courses: [
          ['COMP1100', 'COMP1130'], // Choose one
          ['COMP1110', 'COMP1140'], // Choose one
          ['MATH1005', 'MATH2222'], // Choose one
          'COMP1600',
          'COMP2100',
          'COMP2300',
          'COMP2400',
        ],
      },
      major: {
        name: 'Computing Major',
        description: 'Specialization within computing',
        units: 48,
      },
      relatedCourse: {
        name: 'ICT Related Course',
        description: 'One course from approved ICT-related list',
        units: 6,
        courses: [
          ['ARTH2181', 'ASIA3032', 'DESN2010', 'ENGN1211', 'ENVS2015', 'INFS2024',
           'INFS3002', 'INFS3024', 'MATH1013', 'MATH1115', 'MATH2301', 'MATH2307',
           'MGMT2009', 'MUSI3309', 'SCOM3029', 'SOCY2038', 'SOCY2166', 'STAT1003', 'STAT1008'],
        ],
      },
      electives: {
        name: 'Electives',
        description: 'Remaining units as electives',
        units: 42,
      },
    },
    sharedMandatoryCourses: ['COMP2300', 'ENGN2219'],
  },

  'BSC': {
    code: 'BSC',
    name: 'Bachelor of Science',
    totalUnits: 144,
    duration: 6,
    requirements: {
      scienceMajor: {
        name: 'Science Major',
        description: 'Primary science specialization',
        units: 48,
      },
      scienceMinor: {
        name: 'Science Minor or Second Major',
        description: 'Additional science depth',
        units: 24,
      },
      electives: {
        name: 'Electives',
        description: 'University electives',
        units: 72,
      },
    },
    sharedMandatoryCourses: [],
  },
};

/**
 * Registry of available programs (single degrees and double degree combinations)
 */
export const programConfigs: Record<string, ProgramConfig> = {
  'AENGI': {
    code: 'AENGI',
    name: 'Bachelor of Engineering (Honours)',
    totalUnits: 192,
    duration: 8,
    isDoubleDegree: false,
    degreeComponents: ['AENGI'],
  },
  'AENGI-BCOMP': {
    code: 'AENGI-BCOMP',
    name: 'Bachelor of Engineering (Honours) / Bachelor of Computing',
    totalUnits: 264,
    duration: 11, // 5.5 years = 11 semesters
    isDoubleDegree: true,
    degreeComponents: ['AENGI', 'BCOMP'],
  },
  'AENGI-BSC': {
    code: 'AENGI-BSC',
    name: 'Bachelor of Engineering (Honours) / Bachelor of Science',
    totalUnits: 264,
    duration: 11,
    isDoubleDegree: true,
    degreeComponents: ['AENGI', 'BSC'],
  },
};

/**
 * Get program configuration by code
 */
export function getProgram(programCode: string): ProgramConfig | undefined {
  return programConfigs[programCode];
}

/**
 * Get degree configuration by code
 */
export function getDegree(degreeCode: string): DegreeConfig | undefined {
  return degreeConfigs[degreeCode];
}

/**
 * Get the maximum year number for a program
 * Converts semester duration to years (rounds up for odd semesters)
 */
export function getMaxYear(programCode: string): number {
  const program = programConfigs[programCode];
  if (!program) return 4; // Default to standard 4-year degree
  return Math.ceil(program.duration / 2);
}

/**
 * Get the total number of semesters for a program
 */
export function getTotalSemesters(programCode: string): number {
  const program = programConfigs[programCode];
  return program?.duration ?? 8;
}

/**
 * Check if a course is a shared mandatory course that automatically counts for both degrees
 */
export function isSharedMandatory(courseCode: string, programCode: string): boolean {
  const program = programConfigs[programCode];
  if (!program || !program.isDoubleDegree) return false;

  // Check if the course is in the shared mandatory list of any component degree
  for (const degreeCode of program.degreeComponents) {
    const degree = degreeConfigs[degreeCode];
    if (degree?.sharedMandatoryCourses?.includes(courseCode)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a course is a core/mandatory course for a specific degree
 * (Used to prevent using core courses as electives for another degree)
 */
export function isCoreForDegree(courseCode: string, degreeCode: string): boolean {
  const degree = degreeConfigs[degreeCode];
  if (!degree) return false;

  for (const category of Object.values(degree.requirements)) {
    if (!category.courses) continue;
    for (const courseSpec of category.courses) {
      if (Array.isArray(courseSpec)) {
        // Choice group - check if course is in the options
        if (courseSpec.includes(courseCode)) return true;
      } else {
        // Single required course
        if (courseSpec === courseCode) return true;
      }
    }
  }
  return false;
}

/**
 * Get all available program codes
 */
export function getAvailablePrograms(): ProgramConfig[] {
  return Object.values(programConfigs);
}

/**
 * Determine which degree(s) a course should count toward
 * Returns the degree codes the course counts for
 */
export function getDefaultDegreeAttribution(
  courseCode: string,
  programCode: string,
  manualOverride?: string[]
): string[] {
  // If manual override is set, use it
  if (manualOverride && manualOverride.length > 0) {
    return manualOverride;
  }

  const program = programConfigs[programCode];
  if (!program) return [];

  // For single degrees, course counts for that degree
  if (!program.isDoubleDegree) {
    return [program.degreeComponents[0]];
  }

  // For double degrees, check if it's a shared mandatory course
  if (isSharedMandatory(courseCode, programCode)) {
    return [...program.degreeComponents]; // Counts for both
  }

  // Otherwise, attribute to the first degree where it's a core course
  for (const degreeCode of program.degreeComponents) {
    if (isCoreForDegree(courseCode, degreeCode)) {
      return [degreeCode];
    }
  }

  // Default: count for first degree as an elective
  return [program.degreeComponents[0]];
}

/**
 * Check if a course can be used as an elective for a degree
 * (Core courses from one degree cannot be electives for another in double degrees)
 */
export function canUseAsElective(
  courseCode: string,
  forDegreeCode: string,
  programCode: string
): boolean {
  const program = programConfigs[programCode];
  if (!program || !program.isDoubleDegree) return true;

  // Check if it's a core course for another degree in this program
  for (const degreeCode of program.degreeComponents) {
    if (degreeCode === forDegreeCode) continue;
    if (isCoreForDegree(courseCode, degreeCode)) {
      return false;
    }
  }
  return true;
}
