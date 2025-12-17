import { usePlanStore } from '../store/planStore';
import { SemesterSlot } from './SemesterSlot';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from '@dnd-kit/core';
import { useState } from 'react';
import { CourseCard } from './CourseCard';
import { courses } from '../data/courses';

interface SemesterGridProps {
  planId: string;
}

export function SemesterGrid({ planId }: SemesterGridProps) {
  const { moveCourse, getPlanById } = usePlanStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  const plan = getPlanById(planId);
  if (!plan) return null;

  const years = [1, 2, 3, 4];
  const semesters = [1, 2] as const;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    const courseCode = active.id as string;
    const [, yearStr, semStr] = (over.id as string).split('-');
    const year = parseInt(yearStr);
    const semester = parseInt(semStr) as 1 | 2;

    if (!isNaN(year) && !isNaN(semester)) {
      moveCourse(planId, courseCode, year, semester);
    }
  };

  const activeCourse = activeId ? courses[activeId] : null;

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">
            {plan.name}
            <span className="text-sm font-normal text-gray-500 ml-2">
              Starting Year: {plan.startYear}
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {years.map((year) => (
            <div key={year} className="space-y-4">
              <div className="text-center">
                <h3 className="font-semibold text-gray-700">Year {year}</h3>
                <p className="text-xs text-gray-500">{plan.startYear + year - 1}</p>
              </div>

              {semesters.map((semester) => (
                <SemesterSlot
                  key={`${year}-${semester}`}
                  planId={planId}
                  year={year}
                  semester={semester}
                  startYear={plan.startYear}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300"></div>
              <span>Foundation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-purple-100 border border-purple-300"></div>
              <span>Core</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-orange-100 border border-orange-300"></div>
              <span>Professional</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-100 border border-green-300"></div>
              <span>Major</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gray-100 border border-gray-300"></div>
              <span>Elective</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-100 border border-amber-300"></div>
              <span>Capstone</span>
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeCourse && (
          <div className="opacity-80">
            <CourseCard
              courseCode={activeId!}
              planId={planId}
              isDragging
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
