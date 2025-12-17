import { usePlanStore } from '../store/planStore';
import { courses } from '../data/courses';
import { Check, Minus } from 'lucide-react';

export function ComparisonView() {
  const { plans, comparisonPlanIds, setComparisonPlans, getDegreeProgress } = usePlanStore();

  const comparedPlans = comparisonPlanIds
    .map(id => plans.find(p => p.id === id))
    .filter(Boolean) as typeof plans;

  if (comparedPlans.length < 2) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-gray-500">Select at least 2 plans to compare</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {plans.map(plan => (
            <button
              key={plan.id}
              onClick={() => {
                const newIds = comparisonPlanIds.includes(plan.id)
                  ? comparisonPlanIds.filter(id => id !== plan.id)
                  : [...comparisonPlanIds, plan.id].slice(0, 3);
                setComparisonPlans(newIds);
              }}
              className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                comparisonPlanIds.includes(plan.id)
                  ? 'bg-anu-blue text-white border-anu-blue'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-anu-gold'
              }`}
            >
              {plan.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Get all unique courses across all compared plans
  const allCourses = new Set<string>();
  comparedPlans.forEach(plan => {
    plan.courses.forEach(c => allCourses.add(c.courseCode));
  });

  // Group courses by year/semester
  const coursesBySlot: Record<string, string[]> = {};
  allCourses.forEach(code => {
    comparedPlans.forEach(plan => {
      const pc = plan.courses.find(c => c.courseCode === code);
      if (pc) {
        const key = `${pc.year}-${pc.semester}`;
        if (!coursesBySlot[key]) coursesBySlot[key] = [];
        if (!coursesBySlot[key].includes(code)) {
          coursesBySlot[key].push(code);
        }
      }
    });
  });

  // Get progress for each plan
  const progressByPlan = comparedPlans.map(plan => getDegreeProgress(plan.id));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-anu-blue text-white">
        <h2 className="text-lg font-semibold">Plan Comparison</h2>
        <p className="text-sm text-anu-gold">Comparing {comparedPlans.length} plans</p>
      </div>

      {/* Plan Selector */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-wrap gap-2">
          {plans.map(plan => (
            <button
              key={plan.id}
              onClick={() => {
                const newIds = comparisonPlanIds.includes(plan.id)
                  ? comparisonPlanIds.filter(id => id !== plan.id)
                  : [...comparisonPlanIds, plan.id].slice(0, 3);
                setComparisonPlans(newIds);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                comparisonPlanIds.includes(plan.id)
                  ? 'bg-anu-blue text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-anu-gold'
              }`}
            >
              {plan.name}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 mb-3">Progress Summary</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 pr-4 font-medium text-gray-600">Category</th>
                {comparedPlans.map(plan => (
                  <th key={plan.id} className="text-center py-2 px-4 font-medium text-gray-600">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'foundations', label: 'Foundations' },
                { key: 'engineeringFundamentals', label: 'Eng. Fundamentals' },
                { key: 'professionalCore', label: 'Professional Core' },
                { key: 'major', label: 'Major' },
                { key: 'capstone', label: 'Capstone' },
                { key: 'engnElectives', label: 'ENGN Electives' },
                { key: 'universityElectives', label: 'Uni Electives' },
                { key: 'total', label: 'Total' },
              ].map(({ key, label }) => (
                <tr key={key} className="border-b border-gray-100">
                  <td className="py-2 pr-4 font-medium text-gray-700">{label}</td>
                  {progressByPlan.map((progress, i) => {
                    const cat = progress[key as keyof typeof progress] as { completed: number; required: number };
                    const percentage = Math.round((cat.completed / cat.required) * 100);
                    const isComplete = cat.completed >= cat.required;
                    return (
                      <td key={i} className="text-center py-2 px-4">
                        <span className={`inline-flex items-center gap-1 ${
                          isComplete ? 'text-green-600' : 'text-gray-600'
                        }`}>
                          {cat.completed}/{cat.required}u
                          {isComplete && <Check size={14} />}
                        </span>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1">
                          <div
                            className={`h-full rounded-full ${isComplete ? 'bg-green-500' : 'bg-anu-gold'}`}
                            style={{ width: `${Math.min(100, percentage)}%` }}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Course Comparison Grid */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Course Comparison</h3>

        {/* Year by year comparison */}
        {[1, 2, 3, 4].map(year => (
          <div key={year} className="mb-6">
            <h4 className="text-sm font-medium text-gray-600 mb-2">Year {year}</h4>
            <div className="grid grid-cols-2 gap-4">
              {[1, 2].map(semester => {
                const slotKey = `${year}-${semester}`;
                const slotCourses = coursesBySlot[slotKey] || [];

                return (
                  <div key={semester} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 border-b border-gray-200">
                      Semester {semester}
                    </div>
                    <div className="p-3">
                      {slotCourses.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-2">No courses</p>
                      ) : (
                        <div className="space-y-2">
                          {slotCourses.map(code => {
                            const course = courses[code];
                            const inPlans = comparedPlans.map(plan =>
                              plan.courses.some(c => c.courseCode === code && c.year === year && c.semester === semester)
                            );
                            const allHave = inPlans.every(Boolean);
                            const someHave = inPlans.some(Boolean);

                            return (
                              <div
                                key={code}
                                className={`flex items-center justify-between p-2 rounded text-sm ${
                                  allHave
                                    ? 'bg-green-50'
                                    : someHave
                                    ? 'bg-amber-50'
                                    : 'bg-gray-50'
                                }`}
                              >
                                <div>
                                  <span className="font-mono font-medium">{code}</span>
                                  <span className="text-gray-500 ml-2 text-xs">
                                    {course?.units || 0}u
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {inPlans.map((has, i) => (
                                    <span
                                      key={i}
                                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                                        has
                                          ? 'bg-green-500 text-white'
                                          : 'bg-gray-200 text-gray-400'
                                      }`}
                                      title={comparedPlans[i].name}
                                    >
                                      {has ? <Check size={12} /> : <Minus size={12} />}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
            <span>In all plans</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-50 border border-amber-200 rounded"></div>
            <span>In some plans</span>
          </div>
          <div className="flex items-center gap-2">
            {comparedPlans.map((plan, i) => (
              <span key={i} className="inline-flex items-center gap-1">
                <span className="w-4 h-4 bg-green-500 text-white rounded-full flex items-center justify-center text-[10px]">
                  {i + 1}
                </span>
                <span>{plan.name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
