export const degreeRequirements = {
  singleDegree: {
    name: "Bachelor of Engineering (Honours)",
    code: "AENGI",
    totalUnits: 192,
    duration: 8,
    requirements: {
      foundations: {
        units: 36,
        description: "First-year mathematics, physics, computing, introductory engineering",
        courses: ["MATH1013", "MATH1014", "PHYS1101", "COMP1100", "ENGN1211", "ENGN1217", "ENGN1218"]
      },
      engineeringFundamentals: {
        units: 36,
        description: "Second-year core engineering courses",
        courses: ["ENGN2217", "ENGN2218", "ENGN2219", "ENGN2222", "ENGN2228"]
      },
      professionalCore: {
        units: 24,
        description: "Systems engineering and design sequence",
        courses: ["ENGN2300", "ENGN2301", "ENGN3300", "ENGN3301"]
      },
      major: {
        units: 48,
        description: "Discipline specialization (12 units overlap with foundations)",
        netUnits: 36
      },
      capstone: {
        units: 12,
        description: "Final year project",
        courses: ["ENGN4300"]
      },
      electives: {
        total: 48,
        engnElectives: 24,
        universityElectives: 24,
        description: "24 units ENGN-coded, 24 units any college"
      },
      industryExperience: {
        days: 60,
        course: "ENGN3100",
        description: "Professional work experience"
      }
    },
    honoursCalculation: {
      finalYearWeight: 0.4,
      description: "Final year courses and capstone weighted at 40%"
    }
  },
  doubleDegreeScience: {
    name: "Bachelor of Engineering (Honours) / Bachelor of Science",
    code: "BSC-AENGI",
    totalUnits: 264,
    duration: 11,
    additionalRequirements: {
      scienceMajor: 48,
      level3000Minimum: 30,
      quantitativeResearch: 6
    }
  }
};

export const electronicsCommunicationsMajor = {
  code: "ECSY-MAJ",
  name: "Electronic and Communications Systems",
  totalUnits: 48,
  overlapWithFoundations: 12,
  netAdditionalUnits: 36,

  requiredCourses: [
    { code: "ENGN1218", name: "Introduction to Electronics", units: 6, level: 1000, overlap: true },
    { code: "ENGN2218", name: "Electronic Systems and Design", units: 6, level: 2000, overlap: true },
    { code: "ENGN2228", name: "Signals and Systems", units: 6, level: 2000 },
    { code: "ENGN3226", name: "Digital Communications", units: 6, level: 3000, note: "Being replaced by ENGN3350 from 2027" },
    { code: "ENGN3539", name: "Computer Networks", units: 6, level: 3000 },
    { code: "ENGN4213", name: "Digital Systems and Microprocessors", units: 6, level: 4000 },
    { code: "ENGN4536", name: "Wireless Communications", units: 6, level: 4000 },
    { code: "ENGN4537", name: "Digital Signal Processing", units: 6, level: 4000, note: "Being replaced by ENGN4430 from 2027" },
    { code: "ENGN4625", name: "Power Systems and Power Electronics", units: 6, level: 4000 }
  ],

  alternativeCourses: {
    "ENGN3226": "ENGN3350",
    "ENGN4537": "ENGN4430"
  } as Record<string, string>
};
