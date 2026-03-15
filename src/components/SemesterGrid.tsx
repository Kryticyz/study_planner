import { usePlanStore } from '../store/planStore';
import { SemesterSlot } from './SemesterSlot';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from '@dnd-kit/core';
import { useState } from 'react';
import { CourseCard } from './CourseCard';
import { courses } from '../data/courses';
import { getProgram } from '../data/degreeRegistry';

interface SemesterGridProps {
  planId: string;
}

export function SemesterGrid({ planId }: SemesterGridProps) {
  const { moveCourse, getPlanById, getCombinedDegreeProgress } = usePlanStore();
  const [activeId, setActiveId] = useState<string | null>(null);

  const plan = getPlanById(planId);
  if (!plan) return null;

  const program = getProgram(plan.program ?? 'AENGI');
  const combinedProgress = getCombinedDegreeProgress(planId);
  const attributionByCourseCode = new Map(
    (combinedProgress?.attributionRows ?? [])
      .filter(row => row.kind === 'planned')
      .map(row => [row.code, row] as const)
  );
  const maxYear = program ? Math.ceil(program.duration / 2) : 4;
  const years = Array.from({ length: maxYear }, (_, i) => i + 1);
  const startSemester = plan.startSemester ?? 1;
  // When starting in S2, show S2 first, then S1
  const semesters = startSemester === 1 ? [1, 2] as const : [2, 1] as const;

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
              Starting: {plan.startYear} S{plan.startSemester ?? 1}
            </span>
            {program && (
              <span className="text-xs font-normal text-gray-400 ml-2">
                ({program.name})
              </span>
            )}
          </h2>
        </div>

        <div className={`grid gap-4 ${maxYear <= 4 ? 'grid-cols-4' : maxYear <= 6 ? 'grid-cols-6' : 'grid-cols-6'}`} style={{ gridTemplateColumns: `repeat(${Math.min(maxYear, 6)}, minmax(0, 1fr))` }}>
          {years.map((year) => (
            <div key={year} className="space-y-4">
              <div className="text-center">
                <h3 className="font-semibold text-gray-700">Year {year}</h3>
                <p className="text-xs text-gray-500">
                  {startSemester === 1
                    ? plan.startYear + year - 1
                    : `${plan.startYear + year - 1}-${plan.startYear + year}`}
                </p>
              </div>

              {semesters.map((semester) => (
                <SemesterSlot
                  key={`${year}-${semester}`}
                  planId={planId}
                  year={year}
                semester={semester}
                startYear={plan.startYear}
                startSemester={plan.startSemester ?? 1}
                attributionByCourseCode={attributionByCourseCode}
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
            {program?.isDoubleDegree && (
              <>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-700">
                    ENG
                  </div>
                  <span>Allocated degree</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-0.5 rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700">
                    Shared
                  </div>
                  <span>Counts toward both</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="px-2 py-0.5 rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-700">
                    Major fit
                  </div>
                  <span>Matches the selected major</span>
                </div>
              </>
            )}
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
