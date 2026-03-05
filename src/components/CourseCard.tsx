import { usePlanStore } from '../store/planStore';
import { useUIStore } from '../store/uiStore';
import { courses } from '../data/courses';
import { useDraggable } from '@dnd-kit/core';
import { X, AlertTriangle, Info, CheckCircle } from 'lucide-react';

interface CourseCardProps {
  courseCode: string;
  planId: string;
  isDragging?: boolean;
  compact?: boolean;
  isSpanContinuation?: boolean;
}

const defaultCardStyle = 'bg-white border-gray-200 hover:border-gray-400';

export function CourseCard({ courseCode, planId, isDragging, compact, isSpanContinuation }: CourseCardProps) {
  const { removeCourse, validatePlan, getPlanById, markCompleted, unmarkCompleted } = usePlanStore();
  const { openCourseModal } = useUIStore();
  const course = courses[courseCode];
  const plan = getPlanById(planId);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: courseCode,
    disabled: isSpanContinuation, // Can't drag continuation instances
  });

  if (!course) {
    return (
      <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
        Unknown: {courseCode}
      </div>
    );
  }

  const errors = validatePlan(planId).filter(e => e.courseCode === courseCode);
  const hasError = errors.length > 0;
  const isCompleted = plan?.completedCourses.includes(courseCode);
  const isMultiSemester = (course.semesterSpan ?? 1) > 1;

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const handleToggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCompleted) {
      unmarkCompleted(planId, courseCode);
    } else {
      markCompleted(planId, courseCode);
    }
  };

  if (compact) {
    return (
      <div
        className={`px-2 py-1 rounded text-xs border ${defaultCardStyle} ${
          isCompleted ? 'opacity-60' : ''
        }`}
      >
        <span className="font-medium">{course.code}</span>
        <span className="text-gray-500 ml-1">({course.units}u)</span>
      </div>
    );
  }

  // Simplified view for span continuation (course continues from previous semester)
  if (isSpanContinuation) {
    return (
      <div
        className={`p-2 rounded-lg border-2 border-dashed ${defaultCardStyle} opacity-70`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-sm text-gray-600">{course.code}</span>
            </div>
            <p className="text-xs text-gray-500 italic">Continues...</p>
          </div>
          <span className="text-xs font-medium text-gray-400">{course.units / (course.semesterSpan ?? 1)}u</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group relative p-2 rounded-lg border-2 cursor-grab active:cursor-grabbing transition-all ${defaultCardStyle} ${isDragging ? 'shadow-lg scale-105' : ''} ${
        hasError ? 'ring-2 ring-red-400' : ''
      } ${isCompleted ? 'opacity-60' : ''}`}
    >
      {/* Actions */}
      <div
        className="absolute -top-2 -right-2 hidden group-hover:flex items-center gap-1"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={(e) => { e.stopPropagation(); openCourseModal(courseCode); }}
          className="p-1 bg-white rounded-full shadow hover:bg-gray-100"
          title="View details"
        >
          <Info size={12} className="text-gray-500" />
        </button>
        <button
          onClick={handleToggleComplete}
          className={`p-1 rounded-full shadow ${
            isCompleted ? 'bg-green-500 hover:bg-green-600' : 'bg-white hover:bg-gray-100'
          }`}
          title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
        >
          <CheckCircle size={12} className={isCompleted ? 'text-white' : 'text-gray-500'} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); removeCourse(planId, courseCode); }}
          className="p-1 bg-white rounded-full shadow hover:bg-red-100"
          title="Remove course"
        >
          <X size={12} className="text-red-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-sm text-gray-800">{course.code}</span>
            {hasError && <AlertTriangle size={12} className="text-red-500" />}
            {isCompleted && <CheckCircle size={12} className="text-green-500" />}
          </div>
          <p className="text-xs text-gray-600 truncate">{course.name}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <span className="text-xs font-medium text-gray-500">{course.units}u</span>
        </div>
      </div>

      <div className="mt-1 flex items-center gap-2">
        {isMultiSemester && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
            {course.semesterSpan} sem
          </span>
        )}
        <span className="text-[10px] text-gray-400">
          {course.semesters.join(', ')}
        </span>
      </div>

      {/* Error tooltip */}
      {hasError && (
        <div className="mt-1 text-[10px] text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
          {errors[0].message}
        </div>
      )}
    </div>
  );
}
