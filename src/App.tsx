import { useEffect } from 'react';
import { usePlanStore } from './store/planStore';
import { useUIStore } from './store/uiStore';
import { Header } from './components/Header';
import { SemesterGrid } from './components/SemesterGrid';
import { CoursePanel } from './components/CoursePanel';
import { RequirementsTracker } from './components/RequirementsTracker';
import { ComparisonView } from './components/ComparisonView';
import { CourseModal } from './components/CourseModal';
import { PlanSelector } from './components/PlanSelector';

function App() {
  const { plans, activePlanId, isCompareMode, createPlan } = usePlanStore();
  const { isCoursePanelOpen, showCourseModal, closeCourseModal } = useUIStore();

  // Create a default plan if none exists
  useEffect(() => {
    if (plans.length === 0) {
      createPlan('My Study Plan', 2025);
    }
  }, [plans.length, createPlan]);

  const activePlan = plans.find(p => p.id === activePlanId);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <PlanSelector />
        </div>

        {isCompareMode ? (
          <ComparisonView />
        ) : activePlan ? (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <div className="xl:col-span-3">
              <SemesterGrid planId={activePlan.id} />
            </div>
            <div className="xl:col-span-1">
              <RequirementsTracker planId={activePlan.id} />
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">No study plan selected. Create one to get started.</p>
          </div>
        )}
      </main>

      {/* Course Picker Slide-in Panel */}
      {isCoursePanelOpen && activePlan && (
        <CoursePanel planId={activePlan.id} />
      )}

      {/* Course Detail Modal */}
      {showCourseModal && (
        <CourseModal courseCode={showCourseModal} onClose={closeCourseModal} />
      )}
    </div>
  );
}

export default App;
