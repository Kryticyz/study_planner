import { courses } from '../data/courses';
import { X, BookOpen, Calendar, AlertTriangle, Link, CheckCircle } from 'lucide-react';

interface CourseModalProps {
  courseCode: string;
  onClose: () => void;
}

export function CourseModal({ courseCode, onClose }: CourseModalProps) {
  const course = courses[courseCode];

  if (!course) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{course.code}</h2>
              <p className="text-lg text-gray-600">{course.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-anu-blue text-white rounded-full text-sm">
              {course.units} units
            </span>
            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
              Level {course.level}
            </span>
            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
              {course.college}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm ${
              course.type === 'foundation' ? 'bg-blue-100 text-blue-700' :
              course.type === 'core' ? 'bg-purple-100 text-purple-700' :
              course.type === 'professionalCore' ? 'bg-orange-100 text-orange-700' :
              course.type === 'major' ? 'bg-green-100 text-green-700' :
              course.type === 'capstone' ? 'bg-amber-100 text-amber-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {course.type === 'professionalCore' ? 'Professional Core' :
               course.type === 'engnElective' ? 'ENGN Elective' :
               course.type.charAt(0).toUpperCase() + course.type.slice(1)}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase mb-2">
              <BookOpen size={16} />
              Description
            </h3>
            <p className="text-gray-700">{course.description}</p>
          </div>

          {/* Semester Availability */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase mb-2">
              <Calendar size={16} />
              Offered
            </h3>
            <div className="flex flex-wrap gap-2">
              {course.semesters.map(sem => (
                <span key={sem} className="px-3 py-1 bg-anu-gold/10 text-anu-gold-dark rounded-lg text-sm font-medium">
                  {sem}
                </span>
              ))}
            </div>
            {course.semesterPattern && (
              <p className="mt-2 text-sm text-amber-600 flex items-center gap-1">
                <AlertTriangle size={14} />
                {course.semesterPattern === 'odd_years_only'
                  ? 'Only offered in odd years (2025, 2027, 2029...)'
                  : 'Only offered in even years (2026, 2028, 2030...)'}
              </p>
            )}
          </div>

          {/* Prerequisites */}
          {course.prerequisites.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase mb-2">
                <Link size={16} />
                Prerequisites
              </h3>
              <div className="space-y-2">
                {course.prerequisiteAlternatives ? (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">One of the following combinations:</p>
                    {course.prerequisiteAlternatives.map((alt, i) => (
                      <div key={i} className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-gray-400">{i + 1}.</span>
                        <div className="flex flex-wrap gap-1">
                          {alt.map(code => (
                            <span key={code} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm font-mono">
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {course.prerequisites.map(code => (
                      <span key={code} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm font-mono">
                        {code}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Corequisites */}
          {course.corequisites && course.corequisites.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase mb-2">
                <CheckCircle size={16} />
                Corequisites
              </h3>
              <div className="flex flex-wrap gap-2">
                {course.corequisites.map(code => (
                  <span key={code} className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-sm font-mono">
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Incompatible */}
          {course.incompatible && course.incompatible.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-red-500 uppercase mb-2">
                <AlertTriangle size={16} />
                Incompatible With
              </h3>
              <div className="flex flex-wrap gap-2">
                {course.incompatible.map(code => (
                  <span key={code} className="px-2 py-1 bg-red-50 text-red-700 rounded text-sm font-mono">
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Assumed Knowledge */}
          {course.assumedKnowledge && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                Assumed Knowledge
              </h3>
              <p className="text-gray-700 text-sm">{course.assumedKnowledge}</p>
            </div>
          )}

          {/* Recommended */}
          {course.recommended && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <h3 className="text-sm font-semibold text-green-700 mb-1">Recommendation</h3>
              <p className="text-sm text-green-600">{course.recommended}</p>
            </div>
          )}

          {/* Note */}
          {course.note && (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <h3 className="text-sm font-semibold text-amber-700 mb-1">Note</h3>
              <p className="text-sm text-amber-600">{course.note}</p>
            </div>
          )}

          {/* Major Relevance */}
          {course.majorRelevance && course.majorRelevance.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                Major Relevance
              </h3>
              <div className="flex flex-wrap gap-2">
                {course.majorRelevance.map(major => (
                  <span key={major} className="px-2 py-1 bg-green-50 text-green-700 rounded text-sm">
                    {major === 'ECSY-MAJ' ? 'Electronic & Communications Systems' : major}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
