import { useMemo, useState } from 'react';
import { usePlanStore } from '../store/planStore';
import { courseList, courses, getCoursePrefixes } from '../data/courses';
import { ApprovedCreditLevel } from '../types';
import { Plus, Trash2, GraduationCap } from 'lucide-react';

interface ApprovedCreditManagerProps {
  planId: string;
}

const APPROVED_LEVEL_OPTIONS: ApprovedCreditLevel[] = [1000, 2000, 3000, 4000];

export function ApprovedCreditManager({ planId }: ApprovedCreditManagerProps) {
  const {
    getPlanById,
    addApprovedCourseCredit,
    addUnspecifiedCredit,
    removeApprovedCredit,
  } = usePlanStore();
  const [courseCodeInput, setCourseCodeInput] = useState('');
  const [unspecifiedSchool, setUnspecifiedSchool] = useState('ENGN');
  const [unspecifiedLevel, setUnspecifiedLevel] = useState<ApprovedCreditLevel>(1000);
  const [unspecifiedUnits, setUnspecifiedUnits] = useState(6);

  const plan = getPlanById(planId);
  if (!plan) return null;

  const approvedCredits = plan.approvedCredits ?? [];
  const scheduledCourseCodes = new Set(plan.courses.map(c => c.courseCode));
  const approvedCourseCodes = new Set(
    approvedCredits
      .filter(credit => credit.kind === 'course' && Boolean(credit.courseCode))
      .map(credit => credit.courseCode as string)
  );

  const availableCourseOptions = useMemo(() => {
    return courseList.filter(course =>
      !scheduledCourseCodes.has(course.code) && !approvedCourseCodes.has(course.code)
    );
  }, [scheduledCourseCodes, approvedCourseCodes]);

  const schoolSuggestions = useMemo(() => getCoursePrefixes().sort(), []);

  const handleAddApprovedCourse = () => {
    const normalizedCode = courseCodeInput.trim().toUpperCase();
    if (!normalizedCode || !courses[normalizedCode]) return;
    addApprovedCourseCredit(planId, normalizedCode);
    setCourseCodeInput('');
  };

  const handleAddUnspecified = () => {
    addUnspecifiedCredit(planId, unspecifiedSchool, unspecifiedLevel, unspecifiedUnits);
    setUnspecifiedUnits(6);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <GraduationCap size={16} className="text-anu-blue" />
        <h3 className="font-semibold text-gray-800">Approved Credit</h3>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Approved Subject</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={courseCodeInput}
              onChange={(event) => setCourseCodeInput(event.target.value.toUpperCase())}
              onKeyDown={(event) => event.key === 'Enter' && handleAddApprovedCourse()}
              list={`approved-credit-courses-${planId}`}
              placeholder="e.g. COMP1100"
              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-anu-gold"
            />
            <button
              onClick={handleAddApprovedCourse}
              className="p-2 bg-anu-gold text-white rounded-lg hover:bg-anu-gold-dark transition-colors"
              title="Add approved subject"
            >
              <Plus size={16} />
            </button>
          </div>
          <datalist id={`approved-credit-courses-${planId}`}>
            {availableCourseOptions.map(course => (
              <option key={course.code} value={course.code}>
                {course.name}
              </option>
            ))}
          </datalist>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Unspecified Credit</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              value={unspecifiedSchool}
              onChange={(event) => setUnspecifiedSchool(event.target.value.toUpperCase())}
              list={`approved-credit-schools-${planId}`}
              placeholder="School"
              className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-anu-gold"
            />
            <datalist id={`approved-credit-schools-${planId}`}>
              {schoolSuggestions.map(prefix => (
                <option key={prefix} value={prefix} />
              ))}
            </datalist>

            <select
              value={unspecifiedLevel}
              onChange={(event) => setUnspecifiedLevel(parseInt(event.target.value, 10) as ApprovedCreditLevel)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-anu-gold bg-white"
            >
              {APPROVED_LEVEL_OPTIONS.map(level => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>

            <input
              type="number"
              min={6}
              step={6}
              value={unspecifiedUnits}
              onChange={(event) => setUnspecifiedUnits(parseInt(event.target.value, 10) || 6)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-anu-gold"
              aria-label="Unspecified credit units"
            />

            <button
              onClick={handleAddUnspecified}
              className="px-3 py-1.5 bg-anu-blue text-white rounded-lg hover:bg-anu-blue-dark transition-colors sm:col-span-4"
            >
              Add Unspecified Credit
            </button>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-500 uppercase mb-2">
            Registered ({approvedCredits.length})
          </p>
          {approvedCredits.length === 0 ? (
            <p className="text-sm text-gray-500">No approved credit recorded.</p>
          ) : (
            <div className="space-y-2">
              {approvedCredits.map(credit => {
                const knownCourse = credit.courseCode ? courses[credit.courseCode] : undefined;
                const title = credit.kind === 'course'
                  ? knownCourse
                    ? `${knownCourse.code} ${knownCourse.name}`
                    : credit.courseCode ?? 'Unknown approved subject'
                  : `Unspecified ${credit.school ?? 'UNSPEC'} ${credit.level ?? 1000}-level`;
                const units = knownCourse?.units ?? credit.units;

                return (
                  <div key={credit.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{title}</p>
                      <p className="text-xs text-gray-500">{units} units</p>
                    </div>
                    <button
                      onClick={() => removeApprovedCredit(planId, credit.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                      title="Remove approved credit"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
