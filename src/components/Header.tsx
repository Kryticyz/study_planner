import { usePlanStore } from '../store/planStore';
import { GitCompare, FileDown, FileUp } from 'lucide-react';

export function Header() {
  const { plans, isCompareMode, toggleCompareMode, setComparisonPlans } = usePlanStore();

  const handleExport = () => {
    const data = JSON.stringify(usePlanStore.getState().plans, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'study-plans.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const imported = JSON.parse(text);
        if (Array.isArray(imported)) {
          const store = usePlanStore.getState();
          imported.forEach(plan => {
            const newPlanId = store.createPlan(
              `${plan.name} (Imported)`,
              plan.startYear || 2025,
              plan.startSemester || 1,
              plan.program || 'AENGI'
            );

            // Add scheduled courses from imported plan
            plan.courses?.forEach((c: { courseCode: string; year: number; semester: 1 | 2 }) => {
              store.addCourse(newPlanId, c.courseCode, c.year, c.semester);
            });

            // Add approved credits from imported plan
            plan.approvedCredits?.forEach((credit: {
              kind: 'course' | 'unspecified';
              courseCode?: string;
              school?: string;
              level?: 1000 | 2000 | 3000 | 4000;
              units?: number;
            }) => {
              if (credit.kind === 'course' && credit.courseCode) {
                store.addApprovedCourseCredit(newPlanId, credit.courseCode);
              }
              if (credit.kind === 'unspecified' && credit.school && credit.level) {
                store.addUnspecifiedCredit(newPlanId, credit.school, credit.level, credit.units);
              }
            });
          });
        }
      } catch {
        alert('Invalid file format');
      }
    };
    input.click();
  };

  const handleToggleCompare = () => {
    if (!isCompareMode && plans.length >= 2) {
      setComparisonPlans([plans[0].id, plans[1].id]);
    }
    toggleCompareMode();
  };

  return (
    <header className="bg-anu-blue text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold">ANU Engineering Study Planner</h1>
              <p className="text-sm text-anu-gold">Bachelor of Engineering (Honours)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleCompare}
              disabled={plans.length < 2}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isCompareMode
                  ? 'bg-anu-gold text-anu-blue'
                  : 'bg-anu-blue-light hover:bg-anu-blue-dark'
              } ${plans.length < 2 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <GitCompare size={18} />
              <span className="hidden sm:inline">
                {isCompareMode ? 'Exit Compare' : 'Compare Plans'}
              </span>
            </button>

            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-anu-blue-light hover:bg-anu-blue-dark rounded-lg transition-colors"
            >
              <FileDown size={18} />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              onClick={handleImport}
              className="flex items-center gap-2 px-4 py-2 bg-anu-blue-light hover:bg-anu-blue-dark rounded-lg transition-colors"
            >
              <FileUp size={18} />
              <span className="hidden sm:inline">Import</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
