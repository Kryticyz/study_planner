import { usePlanStore } from '../store/planStore';
import { useUIStore } from '../store/uiStore';
import { CheckCircle, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { DegreeComponentProgress } from '../types';

interface RequirementsTrackerProps {
  planId: string;
}

interface RequirementSectionProps {
  title: string;
  required: number;
  completed: number;
  courseList: string[];
  color: string;
}

function RequirementSection({ title, required, completed, courseList, color }: RequirementSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { openCourseModal } = useUIStore();
  const percentage = Math.min(100, (completed / required) * 100);
  const isComplete = completed >= required;

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="font-medium text-gray-700">{title}</span>
          {isComplete ? (
            <CheckCircle size={14} className="text-green-500" />
          ) : completed > 0 ? (
            <span className="text-xs text-amber-600">{completed}/{required}u</span>
          ) : null}
        </div>
        <span className={`text-sm font-medium ${isComplete ? 'text-green-600' : 'text-gray-500'}`}>
          {completed}/{required}u
        </span>
      </button>

      {/* Progress bar */}
      <div className="px-6 pb-2">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Expanded course list */}
      {isExpanded && courseList.length > 0 && (
        <div className="px-6 pb-3">
          <div className="flex flex-wrap gap-1">
            {courseList.map(code => (
                <button
                  key={code}
                  onClick={() => openCourseModal(code)}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-mono transition-colors"
                >
                  {code}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Component to render a single degree's requirements
function DegreeRequirementsSection({ degreeProgress }: { degreeProgress: DegreeComponentProgress }) {
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-green-500',
    'bg-amber-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500'
  ];

  return (
    <div className="divide-y divide-gray-100">
      {Object.entries(degreeProgress.requirements).map(([key, req], index) => (
        <RequirementSection
          key={key}
          title={req.name}
          required={req.required}
          completed={req.completed}
          courseList={req.completedCourses}
          color={colors[index % colors.length]}
        />
      ))}
    </div>
  );
}

export function RequirementsTracker({ planId }: RequirementsTrackerProps) {
  const { getDegreeProgress, getCombinedDegreeProgress, validatePlan } = usePlanStore();
  const [activeTab, setActiveTab] = useState<'primary' | 'secondary'>('primary');

  // Try new combined progress first, fall back to legacy
  const combinedProgress = getCombinedDegreeProgress(planId);
  const legacyProgress = getDegreeProgress(planId);
  const errors = validatePlan(planId);

  // Use combined progress if available
  if (combinedProgress) {
    const totalPercentage = Math.min(100, (combinedProgress.overallTotal.completed / combinedProgress.overallTotal.required) * 100);
    const primaryPercentage = Math.min(100, (combinedProgress.primary.total.completed / combinedProgress.primary.total.required) * 100);
    const secondaryPercentage = combinedProgress.secondary
      ? Math.min(100, (combinedProgress.secondary.total.completed / combinedProgress.secondary.total.required) * 100)
      : 0;

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-anu-blue text-white">
          <h2 className="font-semibold text-sm">{combinedProgress.programName}</h2>
          <div className="mt-2">
            <div className="flex items-center justify-between text-sm mb-1">
              <span>Total Units</span>
              <span className="font-medium">{combinedProgress.overallTotal.completed} / {combinedProgress.overallTotal.required}</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-anu-gold rounded-full transition-all"
                style={{ width: `${totalPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Validation Errors */}
        {errors.length > 0 && (
          <div className="p-3 bg-red-50 border-b border-red-200">
            <div className="flex items-center gap-2 text-red-700 text-sm font-medium mb-2">
              <AlertCircle size={16} />
              <span>{errors.length} issue{errors.length !== 1 ? 's' : ''} found</span>
            </div>
            <ul className="space-y-1">
              {errors.slice(0, 3).map((error, i) => (
                <li key={i} className="text-xs text-red-600">
                  {error.courseCode && <span className="font-mono">{error.courseCode}: </span>}
                  {error.message}
                </li>
              ))}
              {errors.length > 3 && (
                <li className="text-xs text-red-500">
                  +{errors.length - 3} more issues...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Tabs for double degrees */}
        {combinedProgress.isDoubleDegree && combinedProgress.secondary && (
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('primary')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                activeTab === 'primary'
                  ? 'bg-anu-gold/10 text-anu-gold border-b-2 border-anu-gold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {combinedProgress.primary.name}
              <span className="ml-1 text-gray-400">({Math.floor(primaryPercentage)}%)</span>
            </button>
            <button
              onClick={() => setActiveTab('secondary')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                activeTab === 'secondary'
                  ? 'bg-anu-gold/10 text-anu-gold border-b-2 border-anu-gold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {combinedProgress.secondary.name}
              <span className="ml-1 text-gray-400">({Math.floor(secondaryPercentage)}%)</span>
            </button>
          </div>
        )}

        {/* Requirements Sections */}
        {activeTab === 'primary' && (
          <DegreeRequirementsSection degreeProgress={combinedProgress.primary} />
        )}
        {activeTab === 'secondary' && combinedProgress.secondary && (
          <DegreeRequirementsSection degreeProgress={combinedProgress.secondary} />
        )}

        {/* Summary */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            <p>
              <strong className="text-gray-800">{Math.floor(totalPercentage)}%</strong> complete
            </p>
            <p className="text-xs mt-1">
              {combinedProgress.overallTotal.required - combinedProgress.overallTotal.completed} units remaining
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Fallback to legacy progress display
  const progress = legacyProgress;
  const totalPercentage = Math.min(100, (progress.total.completed / progress.total.required) * 100);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-anu-blue text-white">
        <h2 className="font-semibold">Degree Progress</h2>
        <div className="mt-2">
          <div className="flex items-center justify-between text-sm mb-1">
            <span>Total Units</span>
            <span className="font-medium">{progress.total.completed} / {progress.total.required}</span>
          </div>
          <div className="h-3 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-anu-gold rounded-full transition-all"
              style={{ width: `${totalPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <div className="p-3 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-2 text-red-700 text-sm font-medium mb-2">
            <AlertCircle size={16} />
            <span>{errors.length} issue{errors.length !== 1 ? 's' : ''} found</span>
          </div>
          <ul className="space-y-1">
            {errors.slice(0, 3).map((error, i) => (
              <li key={i} className="text-xs text-red-600">
                {error.courseCode && <span className="font-mono">{error.courseCode}: </span>}
                {error.message}
              </li>
            ))}
            {errors.length > 3 && (
              <li className="text-xs text-red-500">
                +{errors.length - 3} more issues...
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Requirements Sections */}
      <div className="divide-y divide-gray-100">
        <RequirementSection
          title="Foundations"
          required={progress.foundations.required}
          completed={progress.foundations.completed}
          courseList={progress.foundations.courses}
          color="bg-blue-500"
        />
        <RequirementSection
          title="Engineering Fundamentals"
          required={progress.engineeringFundamentals.required}
          completed={progress.engineeringFundamentals.completed}
          courseList={progress.engineeringFundamentals.courses}
          color="bg-purple-500"
        />
        <RequirementSection
          title="Professional Core"
          required={progress.professionalCore.required}
          completed={progress.professionalCore.completed}
          courseList={progress.professionalCore.courses}
          color="bg-orange-500"
        />
        <RequirementSection
          title="Major (Electronics & Comms)"
          required={progress.major.required}
          completed={progress.major.completed}
          courseList={progress.major.courses}
          color="bg-green-500"
        />
        <RequirementSection
          title="Capstone Project"
          required={progress.capstone.required}
          completed={progress.capstone.completed}
          courseList={progress.capstone.courses}
          color="bg-amber-500"
        />
        <RequirementSection
          title="ENGN Electives"
          required={progress.engnElectives.required}
          completed={progress.engnElectives.completed}
          courseList={progress.engnElectives.courses}
          color="bg-teal-500"
        />
        <RequirementSection
          title="University Electives"
          required={progress.universityElectives.required}
          completed={progress.universityElectives.completed}
          courseList={progress.universityElectives.courses}
          color="bg-gray-500"
        />
      </div>

      {/* Summary */}
      <div className="p-4 bg-gray-50 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          <p>
            <strong className="text-gray-800">{Math.floor(totalPercentage)}%</strong> complete
          </p>
          <p className="text-xs mt-1">
            {progress.total.required - progress.total.completed} units remaining
          </p>
        </div>
      </div>
    </div>
  );
}
