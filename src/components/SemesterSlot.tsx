import { usePlanStore } from '../store/planStore';
import { useUIStore } from '../store/uiStore';
import { CourseCard } from './CourseCard';
import { useDroppable } from '@dnd-kit/core';
import { Plus, AlertTriangle } from 'lucide-react';
import { courses as courseData } from '../data/courses';

interface SemesterSlotProps {
  planId: string;
  year: number;
  semester: 1 | 2;
  startYear: number;
  startSemester: 1 | 2;
}

export function SemesterSlot({ planId, year, semester, startYear, startSemester }: SemesterSlotProps) {
  const { getCoursesForSemester, getSemesterUnits } = usePlanStore();
  const { openCoursePanel } = useUIStore();

  const courses = getCoursesForSemester(planId, year, semester);
  const units = getSemesterUnits(planId, year, semester);
  const isOverload = units > 24;

  // Calculate actual calendar year based on start semester
  // When starting S1: both S1 and S2 are in the same calendar year
  // When starting S2: S2 is in startYear+year-1, S1 is in startYear+year (next calendar year)
  const actualYear = startSemester === 1
    ? startYear + year - 1
    : semester === 2
      ? startYear + year - 1
      : startYear + year;

  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${year}-${semester}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[280px] p-3 rounded-lg border-2 transition-all ${
        isOver
          ? 'border-anu-gold bg-anu-gold/5'
          : 'border-gray-200 bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-medium text-gray-600">
            S{semester}
          </span>
          <span className="text-xs text-gray-400 ml-1">
            {actualYear}
          </span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${
          isOverload ? 'text-red-500' : 'text-gray-500'
        }`}>
          {isOverload && <AlertTriangle size={12} />}
          {units}/24u
        </div>
      </div>

      <div className="space-y-2">
        {courses.map((course) => {
          // Check if this is a continuation of a multi-semester course
          const courseInfo = courseData[course.courseCode];
          const isSpanContinuation = Boolean(
            courseInfo?.semesterSpan && courseInfo.semesterSpan > 1 &&
            (course.year !== year || course.semester !== semester)
          );

          return (
            <CourseCard
              key={course.courseCode}
              courseCode={course.courseCode}
              planId={planId}
              isSpanContinuation={isSpanContinuation}
            />
          );
        })}

        <button
          onClick={() => openCoursePanel(year, semester)}
          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:border-anu-gold hover:text-anu-gold transition-colors flex items-center justify-center gap-1"
        >
          <Plus size={16} />
          <span className="text-sm">Add Course</span>
        </button>
      </div>
    </div>
  );
}
