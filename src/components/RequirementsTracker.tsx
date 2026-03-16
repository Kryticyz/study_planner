import { startTransition } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  CheckCircle,
  Circle,
  GraduationCap,
  Layers3,
  Target,
} from 'lucide-react';
import { getMajorsForDegree } from '../data/majorRegistry';
import { getProgram } from '../data/degreeRegistry';
import { CourseAttributionRow, DegreeComponentProgress, RequirementProgress } from '../types';
import { usePlanStore } from '../store/planStore';

interface RequirementsTrackerProps {
  planId: string;
}

const DEGREE_STYLES: Record<string, { accent: string; soft: string; badge: string }> = {
  AENGI: {
    accent: 'bg-sky-600',
    soft: 'bg-sky-50 border-sky-200',
    badge: 'bg-sky-100 text-sky-700',
  },
  BCOMP: {
    accent: 'bg-emerald-600',
    soft: 'bg-emerald-50 border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  BSC: {
    accent: 'bg-amber-600',
    soft: 'bg-amber-50 border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
  },
};

function getDegreeStyle(code: string) {
  return DEGREE_STYLES[code] ?? {
    accent: 'bg-slate-600',
    soft: 'bg-slate-50 border-slate-200',
    badge: 'bg-slate-100 text-slate-700',
  };
}

function getDegreeLabel(code: string) {
  if (code === 'AENGI') return 'ENG';
  if (code === 'BCOMP') return 'COMP';
  if (code === 'BSC') return 'SCI';
  return code;
}

function getProgressWidth(completed: number, required: number) {
  if (required <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((completed / required) * 100)));
}

function sameCodes(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((code, index) => code === sortedRight[index]);
}

function ProgressBar({
  completed,
  required,
  accentClass,
}: {
  completed: number;
  required: number;
  accentClass: string;
}) {
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full ${accentClass}`}
        style={{ width: `${getProgressWidth(completed, required)}%` }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  accentClass,
}: {
  label: string;
  value: string;
  detail: string;
  accentClass: string;
}) {
  return (
    <div className="rounded-2xl border border-white/40 bg-white/80 p-3 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        <span className={`h-2 w-2 rounded-full ${accentClass}`} />
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function RequirementCard({
  requirement,
  accentClass,
}: {
  requirement: RequirementProgress;
  accentClass: string;
}) {
  const eligiblePreview = (requirement.eligibleCourses ?? [])
    .filter(code => !requirement.completedCourses.includes(code))
    .slice(0, 5);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h5 className="text-sm font-semibold text-slate-800">{requirement.name}</h5>
          <p className="mt-1 text-xs text-slate-500">{requirement.description}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-900">
            {requirement.completed}/{requirement.required}u
          </p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
            {requirement.remainingUnits ?? 0}u left
          </p>
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar
          completed={requirement.completed}
          required={requirement.required}
          accentClass={accentClass}
        />
      </div>

      {requirement.completedCourses.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {requirement.completedCourses.slice(0, 6).map(code => (
            <span
              key={code}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700"
            >
              {code}
            </span>
          ))}
          {requirement.completedCourses.length > 6 && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500">
              +{requirement.completedCourses.length - 6} more
            </span>
          )}
        </div>
      )}

      {(requirement.remainingCourseGroups?.length ?? 0) > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
            Remaining course groups
          </p>
          <div className="mt-2 space-y-1.5">
            {requirement.remainingCourseGroups?.slice(0, 3).map((group, index) => (
              <p key={`${group.join('-')}-${index}`} className="text-xs text-amber-900">
                {group.join(' or ')}
              </p>
            ))}
            {(requirement.remainingCourseGroups?.length ?? 0) > 3 && (
              <p className="text-xs text-amber-700">
                +{(requirement.remainingCourseGroups?.length ?? 0) - 3} more groups
              </p>
            )}
          </div>
        </div>
      )}

      {eligiblePreview.length > 0 && (requirement.remainingUnits ?? 0) > 0 && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Already in plan that can help
          </p>
          <p className="mt-1 text-xs text-emerald-900">{eligiblePreview.join(', ')}</p>
        </div>
      )}
    </div>
  );
}

function MajorCard({
  degree,
  accentClass,
}: {
  degree: DegreeComponentProgress;
  accentClass: string;
}) {
  if (!degree.selectedMajor) return null;

  const major = degree.selectedMajor;
  const unresolvedGroups = major.groups.filter(group => !group.satisfiedBy);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-emerald-100 p-2 text-emerald-700">
            <GraduationCap size={16} />
          </div>
          <div>
            <h5 className="text-sm font-semibold text-slate-800">{major.name}</h5>
            <p className="mt-1 text-xs text-slate-500">Selected major for {degree.name}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-900">
            {major.completed}/{major.required}u
          </p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
            {unresolvedGroups.length} groups left
          </p>
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar completed={major.completed} required={major.required} accentClass={accentClass} />
      </div>

      <div className="mt-4 space-y-2">
        {major.groups.map(group => {
          const isComplete = Boolean(group.satisfiedBy);
          return (
            <div
              key={`${group.label}-${group.options.join('-')}`}
              className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${
                isComplete ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-start gap-2">
                {isComplete ? (
                  <CheckCircle size={16} className="mt-0.5 text-emerald-600" />
                ) : (
                  <Circle size={16} className="mt-0.5 text-slate-400" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {group.label}
                  </p>
                  <p className="mt-1 text-sm text-slate-800">
                    {isComplete ? group.satisfiedBy : group.options.join(' or ')}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                  isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {isComplete ? 'Met' : 'Open'}
              </span>
            </div>
          );
        })}
      </div>

      {major.eligibleCourses.length > 0 && unresolvedGroups.length > 0 && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Matching courses already recorded
          </p>
          <p className="mt-1 text-xs text-emerald-900">
            {major.eligibleCourses.filter(code => !major.completedCourses.includes(code)).slice(0, 6).join(', ') || 'None yet'}
          </p>
        </div>
      )}
    </div>
  );
}

function DegreeBoard({
  planId,
  degree,
}: {
  planId: string;
  degree: DegreeComponentProgress;
}) {
  const { setSelectedMajor } = usePlanStore();
  const style = getDegreeStyle(degree.code);
  const majorOptions = getMajorsForDegree(degree.code);

  const requirements = Object.values(degree.requirements);

  return (
    <section className={`rounded-[28px] border p-4 shadow-sm ${style.soft}`}>
      <div className="rounded-[24px] border border-white/70 bg-white/85 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${style.badge}`}>
                {degree.code}
              </span>
              <span className="text-xs uppercase tracking-[0.16em] text-slate-400">Degree board</span>
            </div>
            <h4 className="mt-2 text-lg font-semibold text-slate-900">{degree.name}</h4>
            <p className="mt-1 text-sm text-slate-500">
              {degree.total.completed}/{degree.total.required}u completed
              {typeof degree.attributedUnits === 'number' && ` • ${degree.attributedUnits}u actively allocated`}
            </p>
          </div>
          <div className="min-w-[96px] text-right">
            <p className="text-2xl font-semibold text-slate-900">
              {getProgressWidth(degree.total.completed, degree.total.required)}%
            </p>
            <p className="text-xs text-slate-500">component completion</p>
          </div>
        </div>

        <div className="mt-4">
          <ProgressBar
            completed={degree.total.completed}
            required={degree.total.required}
            accentClass={style.accent}
          />
        </div>

        {majorOptions.length > 0 && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Major selection
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  Swap majors to compare how the same plan satisfies a different pathway.
                </p>
              </div>
              <select
                value={degree.selectedMajor?.code ?? ''}
                onChange={(event) => {
                  startTransition(() => {
                    setSelectedMajor(planId, degree.code, event.target.value);
                  });
                }}
                className="min-w-[220px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-anu-gold"
              >
                {majorOptions.map(major => (
                  <option key={major.code} value={major.code}>
                    {major.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-4">
          <MajorCard degree={degree} accentClass={style.accent} />
          {requirements.map(requirement => (
            <RequirementCard
              key={requirement.name}
              requirement={requirement}
              accentClass={style.accent}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function AttributionStatus({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {label}: {value}
    </span>
  );
}

function AttributionRowCard({
  row,
  primaryCode,
  secondaryCode,
  onOverride,
}: {
  row: CourseAttributionRow;
  primaryCode: string;
  secondaryCode: string;
  onOverride: (row: CourseAttributionRow, degrees: string[]) => void;
}) {
  const autoSelected = sameCodes(row.assignedDegreeCodes, row.defaultDegreeCodes);
  const primarySelected = sameCodes(row.assignedDegreeCodes, [primaryCode]);
  const secondarySelected = sameCodes(row.assignedDegreeCodes, [secondaryCode]);
  const bothSelected = sameCodes(row.assignedDegreeCodes, [primaryCode, secondaryCode]);

  const overrideButtonClass = (isActive: boolean) =>
    `rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
      isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`;

  return (
    <div
      className={`rounded-2xl border p-4 ${
        row.isUnallocated ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{row.code}</span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
              {row.units}u
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
              {row.kind === 'planned' && row.year && row.semester
                ? `Y${row.year} S${row.semester}`
                : 'Approved credit'}
            </span>
            {row.isShared && (
              <span className="rounded-full bg-indigo-100 px-2 py-1 text-[11px] font-semibold text-indigo-700">
                Shared
              </span>
            )}
            {row.isUnallocated && (
              <span className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700">
                Unallocated
              </span>
            )}
          </div>
          <p className="mt-2 truncate text-sm text-slate-600">{row.name}</p>
        </div>

        <div className="flex flex-wrap justify-end gap-1.5">
          <button className={overrideButtonClass(autoSelected)} onClick={() => onOverride(row, [])}>
            Auto
          </button>
          <button
            className={overrideButtonClass(primarySelected)}
            onClick={() => onOverride(row, [primaryCode])}
          >
            {getDegreeLabel(primaryCode)}
          </button>
          <button
            className={overrideButtonClass(secondarySelected)}
            onClick={() => onOverride(row, [secondaryCode])}
          >
            {getDegreeLabel(secondaryCode)}
          </button>
          <button
            className={overrideButtonClass(bothSelected)}
            onClick={() => onOverride(row, [primaryCode, secondaryCode])}
          >
            Both
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <AttributionStatus
          label="Default"
          value={row.defaultDegreeCodes.length > 0 ? row.defaultDegreeCodes.map(getDegreeLabel).join(' + ') : 'Open'}
          className="bg-slate-100 text-slate-700"
        />
        <AttributionStatus
          label="Assigned"
          value={row.assignedDegreeCodes.length > 0 ? row.assignedDegreeCodes.map(getDegreeLabel).join(' + ') : 'Open'}
          className="bg-sky-100 text-sky-700"
        />
        <AttributionStatus
          label="Used by"
          value={row.usedByDegreeCodes.length > 0 ? row.usedByDegreeCodes.map(getDegreeLabel).join(' + ') : 'Unused'}
          className={row.isUnallocated ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}
        />
        {row.selectedMajorNames.length > 0 && (
          <AttributionStatus
            label="Major fit"
            value={row.selectedMajorNames.join(' + ')}
            className="bg-amber-100 text-amber-800"
          />
        )}
      </div>
    </div>
  );
}

export function RequirementsTracker({ planId }: RequirementsTrackerProps) {
  const {
    getPlanById,
    getCombinedDegreeProgress,
    setCourseCountingOverride,
    setApprovedCreditCountingOverride,
  } = usePlanStore();

  const plan = getPlanById(planId);
  const progress = getCombinedDegreeProgress(planId);

  if (!plan || !progress) return null;

  const program = getProgram(plan.program ?? 'AENGI');
  const degrees = progress.secondary ? [progress.primary, progress.secondary] : [progress.primary];
  const primaryCode = progress.primary.code;
  const secondaryCode = progress.secondary?.code;

  const handleOverride = (row: CourseAttributionRow, degreesToAssign: string[]) => {
    startTransition(() => {
      if (row.kind === 'planned') {
        setCourseCountingOverride(planId, row.code, degreesToAssign);
        return;
      }

      const approvedCreditId = row.id.replace(/^approved:/, '');
      setApprovedCreditCountingOverride(planId, approvedCreditId, degreesToAssign);
    });
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_32%),linear-gradient(135deg,_#f8fafc,_#eef6ff)] shadow-sm">
        <div className="border-b border-white/60 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-500">
                <BarChart3 size={16} />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">Degree progress</span>
              </div>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">
                {program?.name ?? progress.programName}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {progress.overallTotal.completed}/{progress.overallTotal.required}u contributing to the overall degree
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold text-slate-900">
                {getProgressWidth(progress.overallTotal.completed, progress.overallTotal.required)}%
              </p>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">overall completion</p>
            </div>
          </div>

          <div className="mt-4">
            <ProgressBar
              completed={progress.overallTotal.completed}
              required={progress.overallTotal.required}
              accentClass="bg-anu-gold"
            />
          </div>
        </div>

        <div className={`grid gap-3 p-5 ${progress.isDoubleDegree ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
          <StatCard
            label={progress.primary.code}
            value={`${progress.primary.total.completed}u`}
            detail={`${progress.primary.total.required}u required`}
            accentClass={getDegreeStyle(progress.primary.code).accent}
          />
          {progress.secondary && (
            <StatCard
              label={progress.secondary.code}
              value={`${progress.secondary.total.completed}u`}
              detail={`${progress.secondary.total.required}u required`}
              accentClass={getDegreeStyle(progress.secondary.code).accent}
            />
          )}
          {progress.isDoubleDegree ? (
            <>
              <StatCard
                label="Shared"
                value={`${progress.sharedUnits}u`}
                detail="counting toward both degree components"
                accentClass="bg-indigo-600"
              />
              <StatCard
                label="Unallocated"
                value={`${progress.unallocatedUnits}u`}
                detail="recorded but not currently satisfying a requirement"
                accentClass={progress.unallocatedUnits > 0 ? 'bg-rose-600' : 'bg-slate-400'}
              />
            </>
          ) : (
            <StatCard
              label="Recorded"
              value={`${progress.attributionRows.length}`}
              detail="planned or approved credit entries"
              accentClass="bg-slate-600"
            />
          )}
        </div>
      </section>

      <section className={`grid gap-4 ${degrees.length > 1 ? 'xl:grid-cols-2' : 'grid-cols-1'}`}>
        {degrees.map(degree => (
          <DegreeBoard key={degree.code} planId={planId} degree={degree} />
        ))}
      </section>

      {progress.isDoubleDegree && secondaryCode && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 text-slate-500">
                <ArrowLeftRight size={16} />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                  Course attribution
                </span>
              </div>
              <h4 className="mt-2 text-lg font-semibold text-slate-900">
                How each entry is being counted
              </h4>
              <p className="mt-1 text-sm text-slate-600">
                Override automatic attribution when a course or approved credit should count toward a different degree component.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              <Layers3 size={14} />
              {progress.attributionRows.length} entries
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {progress.attributionRows.map(row => (
              <AttributionRowCard
                key={row.id}
                row={row}
                primaryCode={primaryCode}
                secondaryCode={secondaryCode}
                onOverride={handleOverride}
              />
            ))}
          </div>
        </section>
      )}

      {progress.unallocatedUnits > 0 && (
        <section className="rounded-[28px] border border-rose-200 bg-rose-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-rose-100 p-2 text-rose-700">
              <Target size={16} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-rose-900">Unallocated credit detected</h4>
              <p className="mt-1 text-sm text-rose-700">
                {progress.unallocatedUnits} units are recorded but not currently satisfying a degree rule. The attribution table above shows which entries need reassignment or a different major selection.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
