import { usePlanStore } from '../store/planStore';
import { useUIStore } from '../store/uiStore';
import { CourseCard } from './CourseCard';
import { useDroppable } from '@dnd-kit/core';
import { Plus, AlertTriangle } from 'lucide-react';

interface SemesterSlotProps {
  planId: string;
  year: number;
  semester: 1 | 2;
  startYear: number;
}

export function SemesterSlot({ planId, year, semester, startYear }: SemesterSlotProps) {
  const { getCoursesForSemester, getSemesterUnits } = usePlanStore();
  const { openCoursePanel } = useUIStore();

  const courses = getCoursesForSemester(planId, year, semester);
  const units = getSemesterUnits(planId, year, semester);
  const isOverload = units > 24;
  const actualYear = startYear + year - 1;

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
        {courses.map((course) => (
          <CourseCard
            key={course.courseCode}
            courseCode={course.courseCode}
            planId={planId}
          />
        ))}

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
