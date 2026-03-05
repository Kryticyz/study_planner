import { useMemo } from 'react';
import { usePlanStore } from '../store/planStore';
import { useUIStore } from '../store/uiStore';
import { courses, courseList } from '../data/courses';
import { describeExpression } from '../utils/prerequisiteEvaluator';
import { X, Search, Plus, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface CoursePanelProps {
  planId: string;
}

export function CoursePanel({ planId }: CoursePanelProps) {
  const { addCourse, getPrerequisitesMet, getPlanById } = usePlanStore();
  const {
    searchQuery,
    levelFilter,
    semesterFilter,
    showPrerequisitesMet,
    targetSemester,
    setSearchQuery,
    setLevelFilter,
    setSemesterFilter,
    setShowPrerequisitesMet,
    closeCoursePanel,
    openCourseModal,
  } = useUIStore();

  const plan = getPlanById(planId);
  const plannedCodes = new Set(plan?.courses.map(c => c.courseCode) || []);
  const approvedCourseCodes = new Set(
    (plan?.approvedCredits ?? [])
      .filter(credit => credit.kind === 'course' && Boolean(credit.courseCode))
      .map(credit => credit.courseCode as string)
  );

  const filteredCourses = useMemo(() => {
    return courseList.filter(course => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesCode = course.code.toLowerCase().includes(query);
        const matchesName = course.name.toLowerCase().includes(query);
        if (!matchesCode && !matchesName) return false;
      }

      // Level filter
      if (levelFilter && course.level !== levelFilter) return false;

      // Semester filter
      if (semesterFilter && !course.semesters.includes(semesterFilter)) return false;

      // Prerequisites met filter
      if (showPrerequisitesMet && targetSemester) {
        const prereqsMet = getPrerequisitesMet(
          planId,
          course.code,
          targetSemester.year,
          targetSemester.semester
        );
        if (!prereqsMet) return false;
      }

      return true;
    });
  }, [searchQuery, levelFilter, semesterFilter, showPrerequisitesMet, targetSemester, planId, getPrerequisitesMet]);

  const handleAddCourse = (courseCode: string) => {
    if (!targetSemester) return;
    addCourse(planId, courseCode, targetSemester.year, targetSemester.semester);
  };

  const checkCourseAvailability = (courseCode: string) => {
    if (!targetSemester || !plan) return { available: true, reason: '' };

    const course = courses[courseCode];
    if (!course) return { available: false, reason: 'Course not found' };

    // Check if already planned
    if (plannedCodes.has(courseCode)) {
      return { available: false, reason: 'Already in plan' };
    }
    if (approvedCourseCodes.has(courseCode)) {
      return { available: false, reason: 'Already added as approved credit' };
    }

    // Check semester availability
    const semStr = targetSemester.semester === 1 ? 'S1' : 'S2';
    if (!course.semesters.includes(semStr) && !course.semesters.includes('Full Year')) {
      return { available: false, reason: `Not offered in S${targetSemester.semester}` };
    }

    // Check biennial scheduling
    const actualYear = plan.startYear + targetSemester.year - 1;
    if (course.semesterPattern === 'odd_years_only' && actualYear % 2 === 0) {
      return { available: false, reason: `Only offered in odd years` };
    }
    if (course.semesterPattern === 'even_years_only' && actualYear % 2 === 1) {
      return { available: false, reason: `Only offered in even years` };
    }

    // Check prerequisites
    const prereqsMet = getPrerequisitesMet(
      planId,
      courseCode,
      targetSemester.year,
      targetSemester.semester
    );
    if (!prereqsMet) {
      return { available: true, reason: 'Prerequisites not met', warning: true };
    }

    // Check incompatibilities
    if (course.incompatible) {
      for (const incomp of course.incompatible) {
        if (plannedCodes.has(incomp)) {
          return { available: false, reason: `Incompatible with ${incomp}` };
        }
      }
    }

    return { available: true, reason: '' };
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 bg-anu-blue text-white">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Add Course</h2>
          <button
            onClick={closeCoursePanel}
            className="p-1 hover:bg-white/20 rounded"
          >
            <X size={20} />
          </button>
        </div>
        {targetSemester && (
          <p className="text-sm text-anu-gold">
            Year {targetSemester.year}, Semester {targetSemester.semester}
            {plan && ` (${plan.startYear + targetSemester.year - 1})`}
          </p>
        )}
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative mb-3">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by code or name..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-anu-gold"
            autoFocus
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <select
            value={levelFilter || ''}
            onChange={(e) => setLevelFilter(e.target.value ? parseInt(e.target.value) : null)}
            className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-anu-gold"
          >
            <option value="">All Levels</option>
            <option value="1000">1000</option>
            <option value="2000">2000</option>
            <option value="3000">3000</option>
            <option value="4000">4000</option>
          </select>

          <select
            value={semesterFilter || ''}
            onChange={(e) => setSemesterFilter(e.target.value as 'S1' | 'S2' | null || null)}
            className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-anu-gold"
          >
            <option value="">All Semesters</option>
            <option value="S1">Semester 1</option>
            <option value="S2">Semester 2</option>
          </select>

          <label className="flex items-center gap-1 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showPrerequisitesMet}
              onChange={(e) => setShowPrerequisitesMet(e.target.checked)}
              className="rounded border-gray-300 text-anu-gold focus:ring-anu-gold"
            />
            <span>Prerequisites met</span>
          </label>
        </div>
      </div>

      {/* Course List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        <p className="text-sm text-gray-500 mb-3">
          {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} found
        </p>

        <div className="space-y-2">
          {filteredCourses.map(course => {
            const availability = checkCourseAvailability(course.code);
            const isPlanned = plannedCodes.has(course.code);
            const isCredited = approvedCourseCodes.has(course.code);
            const isAlreadyAdded = isPlanned || isCredited;

            return (
              <div
                key={course.code}
                className={`p-3 rounded-lg border transition-all ${
                  isAlreadyAdded
                    ? 'bg-green-50 border-green-200'
                    : availability.available
                    ? 'bg-white border-gray-200 hover:border-anu-gold'
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">{course.code}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                        {course.units}u
                      </span>
                      {isAlreadyAdded && (
                        <CheckCircle size={14} className="text-green-500" />
                      )}
                      {availability.warning && (
                        <AlertTriangle size={14} className="text-amber-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">{course.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="text-xs text-gray-400">
                        {course.semesters.join(', ')}
                      </span>
                      {course.prerequisiteExpression && (
                        <span className="text-xs text-gray-400">
                          • Prereqs: {describeExpression(course.prerequisiteExpression)}
                        </span>
                      )}
                    </div>
                    {!availability.available && availability.reason && (
                      <p className="text-xs text-red-500 mt-1">{availability.reason}</p>
                    )}
                    {isCredited && (
                      <p className="text-xs text-green-600 mt-1">Approved credit</p>
                    )}
                    {availability.warning && availability.reason && (
                      <p className="text-xs text-amber-600 mt-1">{availability.reason}</p>
                    )}
                    {course.note && (
                      <p className="text-xs text-blue-600 mt-1">{course.note}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openCourseModal(course.code)}
                      className="p-1.5 hover:bg-gray-100 rounded"
                      title="View details"
                    >
                      <Info size={16} className="text-gray-400" />
                    </button>
                    {!isAlreadyAdded && (
                      <button
                        onClick={() => handleAddCourse(course.code)}
                        disabled={!availability.available}
                        className={`p-1.5 rounded transition-colors ${
                          availability.available
                            ? 'bg-anu-gold text-white hover:bg-anu-gold-dark'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                        title="Add to plan"
                      >
                        <Plus size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
