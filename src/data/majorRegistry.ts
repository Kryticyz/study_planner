import { MajorConfig } from '../types';
import { getEquivalentCourses } from './equivalences';

const ENGINEERING_MAJORS: MajorConfig[] = [
  {
    code: 'ASSY-MAJ',
    name: 'Aerospace Systems',
    degreeCode: 'AENGI',
    totalUnits: 48,
    courseGroups: [
      ['ENGN2222'],
      ['ENGN2228'],
      ['ENGN3223'],
      ['ENGN3338'],
      ['ENGN3339'],
      ['ENGN4337'],
      ['ENGN4338'],
      ['ENGN4339'],
    ],
  },
  {
    code: 'ELCO-MAJ',
    name: 'Electronic and Communication Systems',
    degreeCode: 'AENGI',
    totalUnits: 48,
    aliases: ['ECSY-MAJ'],
    courseGroups: [
      ['ENGN2218'],
      ['ENGN2228'],
      ['ENGN3226', 'ENGN3350'],
      ['ENGN3539'],
      ['ENGN4213'],
      ['ENGN4536'],
      ['ENGN4537', 'ENGN4430'],
      ['ENGN4625'],
    ],
  },
  {
    code: 'ESYS-MAJ',
    name: 'Environmental Systems',
    degreeCode: 'AENGI',
    totalUnits: 48,
    courseGroups: [
      ['ENGN2222'],
      ['ENGN2228'],
      ['ENGN3901'],
      ['ENGN3902'],
      ['ENGN3903'],
      ['ENGN4901'],
      ['ENGN4902'],
      ['ENGN4903'],
    ],
  },
  {
    code: 'INES-MAJ',
    name: 'Intelligent Electronic Systems',
    degreeCode: 'AENGI',
    totalUnits: 48,
    courseGroups: [
      ['ENGN2218'],
      ['ENGN2228'],
      ['ENGN3350'],
      ['ENGN3415'],
      ['ENGN4213'],
      ['ENGN4430'],
      ['ENGN4536'],
      ['ENGN4625'],
    ],
  },
  {
    code: 'MTSY-MAJ',
    name: 'Mechatronic Systems',
    degreeCode: 'AENGI',
    totalUnits: 48,
    courseGroups: [
      ['ENGN1218'],
      ['ENGN2218'],
      ['ENGN2228'],
      ['ENGN3223'],
      ['ENGN3331'],
      ['ENGN4213'],
      ['ENGN4528'],
      ['ENGN4627'],
      ['ENGN4628'],
    ],
  },
  {
    code: 'NUSY-MAJ',
    name: 'Nuclear Systems',
    degreeCode: 'AENGI',
    totalUnits: 48,
    courseGroups: [
      ['ENGN2222'],
      ['ENGN2228'],
      ['ENGN3223'],
      ['ENGN3224'],
      ['ENGN4204'],
      ['ENGN4205'],
      ['ENGN4222'],
      ['ENGN4549'],
    ],
  },
  {
    code: 'RENE-MAJ',
    name: 'Renewable Energy Systems',
    degreeCode: 'AENGI',
    totalUnits: 48,
    courseGroups: [
      ['ENGN2218'],
      ['ENGN2222'],
      ['ENGN3224'],
      ['ENGN3516'],
      ['ENGN4524'],
      ['ENGN4547'],
      ['ENGN4548'],
      ['ENGN4625'],
    ],
  },
];

const majorConfigs: Record<string, MajorConfig> = {};
const aliasToMajorCode: Record<string, string> = {};

for (const major of ENGINEERING_MAJORS) {
  majorConfigs[major.code] = major;
  aliasToMajorCode[major.code] = major.code;
  for (const alias of major.aliases ?? []) {
    aliasToMajorCode[alias] = major.code;
  }
}

const defaultMajorByDegree: Record<string, string> = {
  AENGI: 'ELCO-MAJ',
};

export function resolveMajorCode(majorCode: string): string {
  return aliasToMajorCode[majorCode] ?? majorCode;
}

export function getMajor(majorCode: string): MajorConfig | undefined {
  return majorConfigs[resolveMajorCode(majorCode)];
}

export function getMajorsForDegree(degreeCode: string): MajorConfig[] {
  return Object.values(majorConfigs).filter(major => major.degreeCode === degreeCode);
}

export function getDefaultMajorForDegree(degreeCode: string): string | undefined {
  return defaultMajorByDegree[degreeCode];
}

export function getMajorName(majorCode: string): string {
  return getMajor(majorCode)?.name ?? majorCode;
}

export function isCourseInMajor(courseCode: string, majorCode: string): boolean {
  const major = getMajor(majorCode);
  if (!major) return false;

  const equivalents = getEquivalentCourses(courseCode);
  return major.courseGroups.some(group =>
    group.some(option => equivalents.includes(option))
  );
}

export function getMajorsForCourse(courseCode: string, degreeCode?: string): MajorConfig[] {
  const majors = degreeCode ? getMajorsForDegree(degreeCode) : Object.values(majorConfigs);
  return majors.filter(major => isCourseInMajor(courseCode, major.code));
}
